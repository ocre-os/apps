import hashlib
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from verificar_fuentes import validate

class SourceTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.addCleanup(self.t.cleanup)
        self.root = Path(self.t.name)
        self.items = []
        for role, suffix in (('investigador','enunciado'),('revisor','desenlace')):
            d = self.root / role; d.mkdir()
            for case in ('S01', 'M02', 'A01'):
                name=f'{case}-{suffix}.md'; payload=f'{role}:{case}'.encode()
                (d/name).write_bytes(payload)
                self.items.append({'path':f'{role}/{name}','sha256':hashlib.sha256(payload).hexdigest(),'role':role})
        self.manifest = self.root / 'manifest.json'
        self.save()
        self.zips={}
        for role in ('investigador','revisor'):
            self.zips[role]=self.root / f'{role}.zip'
            self.pack(role)
    def save(self):
        self.manifest.write_text(json.dumps({'schema':'prisma-pilot-source-files-v1','files':self.items}),encoding='utf-8')
    def pack(self, role, extras=None):
        with zipfile.ZipFile(self.zips[role], 'w') as z:
            for x in self.items:
                if x['role']==role:
                    z.write(self.root/x['path'], Path(x['path']).name)
            for name, content in (extras or {}).items(): z.writestr(name,content)
    def check(self):
        return validate(self.manifest,self.root,self.zips['investigador'],self.zips['revisor'])
    def test_good(self):
        v=self.check();self.assertEqual(v['files_verified'],6)
        self.assertEqual(v['cases'],['A01','M02','S01'])
        self.assertFalse(v['human_blinding_verified'])
    def test_altered_source(self):
        (self.root/'investigador/S01-enunciado.md').write_text('distinto')
        with self.assertRaisesRegex(ValueError,'SHA-256'): self.check()
    def test_role_cross_contamination(self):
        self.pack('investigador',{'A01-desenlace.md':'accidental'})
        with self.assertRaisesRegex(ValueError,'rol'): self.check()
    def test_missing_case_in_zip(self):
        with zipfile.ZipFile(self.zips['investigador'],'w') as z:
            z.writestr('S01-enunciado.md',b'x')
        with self.assertRaisesRegex(ValueError,'faltan expedientes'): self.check()
    def test_zip_bad_content(self):
        with zipfile.ZipFile(self.zips['revisor'],'w') as z:
            for case in ('S01','M02','A01'): z.writestr(f'{case}-desenlace.md',b'wrong')
        with self.assertRaisesRegex(ValueError,'contenido no corresponde'): self.check()
    def test_no_zips(self):
        self.assertFalse(validate(self.manifest,self.root)['role_zip_separation_verified'])
    def test_only_one_zip(self):
        with self.assertRaisesRegex(ValueError,'ambos ZIP'): validate(self.manifest,self.root,self.zips['investigador'])
    def test_missing_peer(self):
        self.items.pop(); self.save()
        with self.assertRaisesRegex(ValueError,'Cada análisis'): validate(self.manifest,self.root)
    def test_duplicate_manifest(self):
        self.items.append(self.items[0]); self.save()
        with self.assertRaisesRegex(ValueError,'duplicado'): self.check()
    def test_path_traversal(self):
        self.items[0]['path']='investigador/../secret.md'; self.save()
        with self.assertRaisesRegex(ValueError,'ruta insegura'): self.check()
    def test_mismatched_role(self):
        self.items[0]['role']='revisor'; self.save()
        with self.assertRaisesRegex(ValueError,'rol incompatible'): self.check()
    def test_bad_digest(self):
        self.items[0]['sha256']='garbage'; self.save()
        with self.assertRaisesRegex(ValueError,'hexadecimal'): self.check()
    def test_symlink_outside(self):
        p=self.root/'investigador/A01-enunciado.md';p.unlink()
        outside=self.root.parent/f'external-{self.root.name}.md';outside.write_text('outside')
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        p.symlink_to(outside)
        with self.assertRaisesRegex(ValueError,'fuera de raíz'): self.check()
    def test_unknown_schema(self):
        self.manifest.write_text(json.dumps({'schema':'invalid','files':self.items}))
        with self.assertRaisesRegex(ValueError,'Esquema'): self.check()

if __name__=='__main__': unittest.main(verbosity=2)
