import {readFileSync,readdirSync,statSync} from 'node:fs';
import ts from 'typescript';
import {parseTemplate} from '@angular/compiler';

const walk=directory=>readdirSync(directory).flatMap(name=>{
  const path=directory+'/'+name;return statSync(path).isDirectory()?walk(path):[path];
});
const files=walk('src/app');
const program=ts.createProgram(files.filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts')),
  {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true});
const checker=program.getTypeChecker();
const signalType=type=>type.getProperties().some(property=>property.name.includes('SIGNAL@'));
const formType=type=>/^(?:FormGroup|FormControl|FormArray|UntypedFormGroup|AbstractControl)(?:<|$)/.test(checker.typeToString(type));
const violations=[];const inspected=[];
const entries=files.filter(file=>file.endsWith('.html')).map(file=>({
  file,source:program.getSourceFile(file.replace(/\.html$/,'.ts')),text:readFileSync(file,'utf8'),host:false,
})).filter(entry=>entry.source);
for(const file of files.filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts'))){
  const source=program.getSourceFile(file);
  if(!source)continue;
  const collectMetadata=node=>{
    if(ts.isPropertyAssignment(node)&&node.name.getText(source)==='template'&&
      (ts.isStringLiteral(node.initializer)||ts.isNoSubstitutionTemplateLiteral(node.initializer))){
      entries.push({file:file+'#inline',source,text:node.initializer.text,host:false});
    }
    if(ts.isPropertyAssignment(node)&&node.name.getText(source)==='host'&&ts.isObjectLiteralExpression(node.initializer)){
      for(const binding of node.initializer.properties){
        if(!ts.isPropertyAssignment(binding)||!ts.isStringLiteral(binding.name)||!ts.isStringLiteral(binding.initializer))continue;
        if(!binding.name.text.startsWith('['))continue;
        const expression=binding.initializer.text.replaceAll('&','&amp;').replaceAll('"','&quot;');
        entries.push({file:file+'#host:'+binding.name.text,source,text:`<div ${binding.name.text}="${expression}"></div>`,host:true});
      }
    }
    ts.forEachChild(node,collectMetadata);
  };collectMetadata(source);
}
for(const {file,source,text:markup} of entries){
  const members=new Map();
  const classes=node=>{
    if(ts.isClassDeclaration(node))for(const member of node.members)if(member.name){
      const type=checker.getTypeAtLocation(member);
      members.set(member.name.getText(source),{signal:signalType(type),form:formType(type),type});
    }
    ts.forEachChild(node,classes);
  };classes(source);
  const template=parseTemplate(markup,file,{preserveWhitespaces:true});
  if(template.errors?.length)throw new Error('Template parse error: '+file);
  const locals=new Set();
  const collect=node=>{
    for(const reference of node.references??[])locals.add(reference.name);
    if(node.item?.name)locals.add(node.item.name);
    if(node.expressionAlias?.name)locals.add(node.expressionAlias.name);
    if(node.constructor?.name==='LetDeclaration')locals.add(node.name);
    for(const variable of node.contextVariables??[])locals.add(variable.name);
    for(const key of ['children','inputs','templateAttrs','branches','cases'])for(const child of node[key]??[])collect(child);
  };template.nodes.forEach(collect);
  const found=new Set();
  const astType=ast=>{
    if(!ast)return undefined;
    if(['PropertyRead','SafePropertyRead'].includes(ast.constructor?.name)){
      if(ast.receiver?.constructor?.name==='ImplicitReceiver')return locals.has(ast.name)?undefined:members.get(ast.name)?.type;
      const receiver=astType(ast.receiver);
      const property=receiver?checker.getNonNullableType(receiver).getProperty(ast.name):undefined;
      return property?checker.getTypeOfSymbolAtLocation(property,source):undefined;
    }
    if(['Call','SafeCall'].includes(ast.constructor?.name)){
      const receiver=astType(ast.receiver);
      const signature=receiver?checker.getSignaturesOfType(checker.getNonNullableType(receiver),ts.SignatureKind.Call)[0]:undefined;
      return signature?checker.getReturnTypeOfSignature(signature):undefined;
    }
    return undefined;
  };
  const expression=ast=>{
    if(!ast||typeof ast!=='object')return;
    const type=ast.constructor?.name;
    if(['Call','SafeCall'].includes(type)){
      const callable=astType(ast.receiver);
      if(!callable||!signalType(checker.getNonNullableType(callable)))found.add('call:'+ (ast.receiver?.name??type));
    }
    if(type==='PropertyRead'&&ast.receiver?.constructor?.name==='ImplicitReceiver'&&!locals.has(ast.name)){
      const member=members.get(ast.name);
      if(member&&!member.signal&&!member.form)found.add(ast.name);
    }
    for(const [key,value]of Object.entries(ast)){
      if(['sourceSpan','nameSpan','span','source','location'].includes(key))continue;
      if(Array.isArray(value))value.forEach(expression);else if(value&&typeof value==='object')expression(value);
    }
  };
  const visit=node=>{
    const type=node.constructor?.name;
    if(type==='BoundAttribute'||type==='BoundText')expression(node.value?.ast??node.value);
    if(['IfBlockBranch','SwitchBlock','SwitchBlockCase','ForLoopBlock','LetDeclaration'].includes(type))expression(node.expression?.ast??node.expression??node.value?.ast??node.value);
    if(type==='ForLoopBlock')expression(node.trackBy?.ast??node.trackBy);
    for(const key of ['children','inputs','templateAttrs','branches','cases'])for(const child of node[key]??[])visit(child);
  };template.nodes.forEach(visit);inspected.push(file);
  if(found.size)violations.push({file,members:[...found].sort()});
}
console.log(JSON.stringify({templates:entries.filter(entry=>!entry.host).length,
  externalTemplates:entries.filter(entry=>!entry.host&&!entry.file.endsWith('#inline')).length,
  inlineTemplates:entries.filter(entry=>entry.file.endsWith('#inline')).length,
  hostBindings:entries.filter(entry=>entry.host).length,violations},null,2));
if(violations.length)process.exitCode=1;
