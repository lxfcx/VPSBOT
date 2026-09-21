import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {writeFile,readFile,rename,unlink,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function openStorage(directory,migrations){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const sqlite=new DatabaseSync(join(directory,'monitor.sqlite'));
 sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS vps_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
 for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
  const sql=readFileSync(join(migrations,name),'utf8'),sum=createHash('sha256').update(sql).digest('hex'),applied=sqlite.prepare('SELECT checksum FROM vps_migrations WHERE name=?').get(name);
  if(applied){if(applied.checksum!==sum)throw new Error('Applied migration changed: '+name);continue}
  sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO vps_migrations VALUES (?,?)').run(name,sum);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}
 }
 function statement(sql,params=[]){return {bind(...args){return statement(sql,args)},async first(column){const row=sqlite.prepare(sql).get(...params)||null;return column?row?.[column]??null:row},async all(){return {results:sqlite.prepare(sql).all(...params)}},execute(){const r=sqlite.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}},async run(){return this.execute()}}}
 const DB={prepare:statement,async batch(items){sqlite.exec('BEGIN IMMEDIATE');try{const out=items.map(s=>s.execute());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const dir=join(directory,'uploads');mkdirSync(dir,{recursive:true,mode:0o700});
 const path=key=>join(dir,createHash('sha256').update(key).digest('hex')+'.json');
 const FILES={async put(key,data,options={}){const dest=path(key),temp=dest+'.'+randomUUID()+'.tmp';try{await writeFile(temp,JSON.stringify({type:options.httpMetadata?.contentType||'application/octet-stream',data:Buffer.from(data).toString('base64')}),{mode:0o600});await rename(temp,dest)}finally{await unlink(temp).catch(()=>{})}},async get(key){try{const file=JSON.parse(await readFile(path(key),'utf8'));return {body:Buffer.from(file.data,'base64'),httpMetadata:{contentType:file.type}}}catch(e){if(e.code==='ENOENT')return null;throw e}},async delete(key){await unlink(path(key)).catch(e=>{if(e.code!=='ENOENT')throw e})}};
 return {DB,FILES,sqlite,close:()=>sqlite.close()};
}
