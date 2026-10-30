"""Record original source hashes, methods and XAML controls without shipping binaries.

Usage: python3 scripts/inventory-originals.py CODING_SOURCE SCANS_SOURCE TOOLBOX_SOURCE
The first two roots contain the recovered HUBerlin/IQB/Kodieren and Scans files;
the third is the upstream itc-toolbox checkout. No Windows application is modified.
"""
import argparse, hashlib, json, re
from pathlib import Path
import xml.etree.ElementTree as ET

p = argparse.ArgumentParser(description=__doc__)
for name in ('coding', 'scans', 'toolbox'):
    p.add_argument(name, type=Path)
p.add_argument('--output', type=Path, default=Path('docs/original-inventory.json'))
args = p.parse_args()
matrix = json.loads(Path('docs/function-matrix.json').read_text())
files, surfaces = [], []
inactive = {
    'scans/EditJobOptionsUserControl.xaml': 'Editor der gemeinsamen Bibliothek; vom Kodierer nicht aufgerufen.',
    'scans/PageImageFrameSetControl.xaml': 'Rahmeneditor für andere Anwendungen; kein Aufruf im Kodierer.',
    'scans/SelectVariableDialog.xaml': 'Bibliotheksdialog für andere Anwendungen.',
    'scans/SelectBookletPageDialog.xaml': 'Bibliotheksdialog für andere Anwendungen.',
    'scans/IgnoreCodesPatternsDialog.xaml': 'Bibliotheksdialog für andere Anwendungen.',
    'toolbox/itc-output/read/readJsonFilesDialog.xaml': 'Kein erreichbarer Einstieg in MainWindow.xaml (T-26).',
}
tags = {'Button','ButtonOpen','ButtonHelp','ButtonHelpSmall','CheckBox','RadioButton',
        'MenuItem','Slider','ComboBox','TextBox','ToggleButton','DataGridTextColumn','DataGridTemplateColumn'}
for group in ('coding','scans','toolbox'):
    root = getattr(args,group)
    for file in sorted(root.rglob('*')):
        if not file.is_file() or file.suffix not in ('.cs','.vb','.xaml'):
            continue
        relative = file.relative_to(root).as_posix()
        if any(part in ('My','My Project','XamlGeneratedNamespace','obj','bin') for part in file.relative_to(root).parts):
            continue
        path = group+'/'+relative
        source = file.read_text(encoding='utf-8-sig')
        methods = []
        for line, value in enumerate(source.splitlines(),1):
            if re.search(r'\b(?:Sub|Function)\s+\w+\s*\(|\b(?:public|private|internal)\s+(?:static\s+)?[\w<>]+\s+\w+\s*\(',value):
                methods.append({'line':line,'signature':value.strip()})
        files.append({'path':path,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                      'lines':len(source.splitlines()),'methods':methods})
        if file.suffix != '.xaml':
            continue
        tree = ET.fromstring(source)
        controls = []
        for el in tree.iter():
            tag = el.tag.split('}')[-1]
            if tag not in tags:
                continue
            attributes = {k.split('}')[-1]:v for k,v in el.attrib.items()}
            label = ' '.join(''.join(el.itertext()).split())[:240]
            controls.append({'tag':tag,'name':attributes.get('Name',attributes.get('FrameworkElement.Name','')),
                             'command':attributes.get('Command',attributes.get('ButtonBase.Command','')),
                             'click':attributes.get('Click',''),'label':label,
                             'tooltip':attributes.get('ToolTip',attributes.get('FrameworkElement.ToolTip',''))})
        if controls:
            associated = [f['id'] for f in matrix['features'] if f['original']['path'].removesuffix('.vb').removesuffix('.cs') == path.removesuffix('.cs')]
            surfaces.append({'path':path,'reachability':'excluded' if path in inactive else 'reachable',
                             'reason':inactive.get(path,'Erreichbarer Dialog oder eingebundenes Control; Zuordnung zu den funktionalen Bereichen in function-matrix.json.'),
                             'featuresFromSameSource':associated,'controls':controls})
result = {'schemaVersion':1,'date':matrix['date'],'scope':matrix['scope'],
          'note':'Inventar ist eine Such- und Prüfgrundlage, kein Ausführungsnachweis. Methoden enthalten auch Hilfsfunktionen. Deaktivierte Controls/Kommandos sind nicht automatisch aktive Arbeitsaufträge.',
          'files':files,'surfaces':surfaces}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(len(files),'source files;',len(surfaces),'XAML surfaces;',sum(len(s['controls']) for s in surfaces),'controls')
