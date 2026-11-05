const {readdirSync}=require('node:fs');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=readdirSync(path.join(root,'tests')).filter(f=>/^test.*\.cjs$/.test(f)).sort();
for(const file of files){
  const result=spawnSync(process.execPath,[path.join(root,'tests',file)],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`All ${files.length} test suites passed.`);
