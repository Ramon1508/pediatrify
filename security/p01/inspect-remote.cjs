// Read-only inspection. Credentials stay inside the Firebase CLI client.
// No business documents, Auth users, or token values are read or printed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function main() {
  const cliRoot = process.env.P01_FIREBASE_TOOLS_ROOT;
  if (!cliRoot) throw new Error('Set P01_FIREBASE_TOOLS_ROOT to an installed firebase-tools directory.');
  const cli = (name) => require(path.join(cliRoot, 'lib', name));
  cli('logger').logger.silent = true;
  const projectRoot = path.resolve(__dirname, '../..');
  const project = JSON.parse(fs.readFileSync(path.join(projectRoot, '.firebaserc'), 'utf8')).projects.default;
  const account = cli('auth').getProjectDefaultAccount(projectRoot);
  if (!account) throw new Error('Firebase CLI has no configured account.');
  await cli('requireAuth').requireAuth({ project, ...account, nonInteractive: true });
  const { Client } = cli('apiv2');
  const dbClient = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const database = (await dbClient.get(`/projects/${project}/databases/(default)`)).body;
  const rules = cli('gcp/rules');
  const releases = await rules.listAllReleases(project);
  const output = {
    inspectedAt: new Date().toISOString(),
    project: 'configured default alias (identifier omitted)',
    database: '(default)',
    edition: database.databaseEdition,
    location: database.locationId,
    businessDataRead: false,
    remoteChanges: false,
    releases: [],
  };
  for (const release of releases) {
    if (!release.name.includes('/releases/cloud.firestore') && !release.name.includes('/releases/firebase.storage')) continue;
    const files = await rules.getRulesetContent(release.rulesetName);
    const service = release.name.includes('/releases/cloud.firestore') ? 'firestore' : 'storage';
    const local = service === 'firestore' ? fs.readFileSync(path.join(projectRoot, 'firestore.rules'), 'utf8') : null;
    output.releases.push({
      service,
      updatedAt: release.updateTime ?? release.createTime,
      files: files.map((file) => {
        const source = file.content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        return {
          sha256: crypto.createHash('sha256').update(file.content).digest('hex'),
          matchesLocalIgnoringWhitespace: local === null ? null : source.replace(/\s/g, '') === local.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s/g, ''),
          unconditionalRecursiveReadWrite: /match\s*\/\{\w+=\*\*\}\s*\{\s*allow\s+(?:read\s*,\s*write|write\s*,\s*read)\s*:\s*if\s+true\s*;\s*\}/.test(source),
          allowsAnySignedInUser: /allow\s+[^;]+:\s*if\s+request\.auth\s*!=\s*null\s*;/.test(source),
        };
      }),
    });
  }
  const target = path.join(__dirname, 'remote-inspection.json');
  fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch((error) => {
  // Avoid serializing CLI errors: their nested requests can contain credentials.
  process.stderr.write(`Read-only Firebase inspection failed (${error.status ?? 'no status'}).\n`);
  process.exitCode = 1;
});
