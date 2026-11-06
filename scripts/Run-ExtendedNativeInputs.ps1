param([string]$Root=$PSScriptRoot,[string]$OriginalRoot=(Join-Path $Root 'originals'))
$ErrorActionPreference='Stop'
[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
[Threading.Thread]::CurrentThread.CurrentUICulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
$Root=[IO.Path]::GetFullPath($Root)
$OriginalRoot=[IO.Path]::GetFullPath($OriginalRoot)
$Out=Join-Path $Root 'native-extended-valid'
if((Test-Path $Out) -and (Get-ChildItem $Out -Force | Select-Object -First 1)){throw 'Use a fresh Root: refusing to mix native outputs from different runs.'}
[IO.Directory]::CreateDirectory($Out)|Out-Null
Add-Type -AssemblyName System.Xml.Linq
Add-Type -AssemblyName PresentationFramework
$ToolPath=Join-Path $OriginalRoot 'itc-ToolBox'
$CodePath=Join-Path $OriginalRoot 'IQB-Kodieren'
$AssemblyHandler=[ResolveEventHandler]{param($sender,$eventArgs)
 $name=([Reflection.AssemblyName]$eventArgs.Name).Name+'.dll'
 foreach($folder in @($ToolPath,$CodePath)) {
  $path=Join-Path $folder $name
  if(Test-Path $path){return [Reflection.Assembly]::LoadFrom($path)}
 }
 return $null
}
[AppDomain]::CurrentDomain.add_AssemblyResolve($AssemblyHandler)
$Tool=[Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'itc-Toolbox.exe'))
$Json=[Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'Newtonsoft.Json.dll'))
$Code=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Kodieren.exe'))
$Scans=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Scans.dll'))
$Common=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Common.dll'))
# Apply the unchanged application's provider declaration to this test process.
# The executable normally obtains it from itc-Toolbox.exe.config; PowerShell
# otherwise uses its own config and cannot resolve the original SQLite provider.
Add-Type -AssemblyName System.Data
Add-Type -AssemblyName System.Configuration
$originalConfig=[xml][IO.File]::ReadAllText((Join-Path $ToolPath 'itc-Toolbox.exe.config'))
$providerConfig=[Configuration.ConfigurationManager]::GetSection('system.data')
$providerTable=$providerConfig.Tables['DbProviderFactories']
foreach($provider in $originalConfig.configuration.'system.data'.DbProviderFactories.add){
 $row=$providerTable.NewRow();$row.Name=[string]$provider.name;$row.Description=[string]$provider.description;$row.InvariantName=[string]$provider.invariant;$row.AssemblyQualifiedName=[string]$provider.type;$providerTable.Rows.Add($row)
}
function Unwrap-Arguments([object[]]$Values){
 $raw=[object[]]::new($Values.Length)
 for($i=0;$i -lt $Values.Length;$i++){if($null -ne $Values[$i]){$raw[$i]=$Values[$i].PSObject.BaseObject}}
 return ,$raw
}
$Results=New-Object Collections.Generic.List[object]
function New-BackendObject([string]$name){
 $t=$Tool.GetType('iqb.testcenter.toolbox.'+$name)
 $obj=[Runtime.Serialization.FormatterServices]::GetUninitializedObject($t)
 foreach($field in @('ErrorMessages','Warnings','Testgroups')){
  $f=$t.GetField($field,([Reflection.BindingFlags]'NonPublic,Instance'))
  if($f){$f.SetValue($obj,[Activator]::CreateInstance($f.FieldType))}
 }
 return $obj
}
function Get-OriginalSettings {
 return $Tool.GetType('iqb.testcenter.toolbox.My.MySettingsProperty').GetProperty('Settings',([Reflection.BindingFlags]'NonPublic,Public,Static')).GetValue($null,$null)
}

# Calls unchanged dialog worker methods, not UI automation. The separate GUI
# captures exercise the actual controls. Generated identities are random: the
# paired checks compare constraints, modes, counts and preserved values.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Collections.Generic;
public sealed class NativeEvidenceWorker : BackgroundWorker {
 public readonly List<string> Messages = new List<string>();
 protected override void OnProgressChanged(ProgressChangedEventArgs e) {
  lock(Messages) if(e.UserState != null) Messages.Add(e.UserState.ToString());
 }
}
'@
function Invoke-OriginalWorker($obj,[string]$method) {
 $worker=New-Object NativeEvidenceWorker;$worker.WorkerReportsProgress=$true;$worker.WorkerSupportsCancellation=$true
 $event=[ComponentModel.DoWorkEventArgs]::new($null)
 $obj.GetType().GetMethod($method,([Reflection.BindingFlags]'NonPublic,Instance')).Invoke($obj,(Unwrap-Arguments ([object[]]@($worker,$event))))|Out-Null
 return ,$worker.Messages.ToArray()
}
function Capture-Files([string]$folder) {
 $files=@();foreach($file in Get-ChildItem $folder -File){
  if($file.Extension -in @('.xlsx','.xml')){$bytes=[IO.File]::ReadAllBytes($file.FullName);$files+=@{name=$file.Name;bytes=$bytes.Length;sha256=(Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant();base64=[Convert]::ToBase64String($bytes)}}
 };return ,$files
}
function Fields($obj) {
 $result=@{};foreach($name in @('ErrorMessages','Warnings','Testgroups','loginCount')){
  $field=$obj.GetType().GetField($name,([Reflection.BindingFlags]'NonPublic,Instance'))
  if($field){$result[$name]=$field.GetValue($obj)}
 };return $result
}
$settings=Get-OriginalSettings
foreach($name in @('Booklet','Booklet-bad-reference','Booklet-empty-title')) {
 $folder=Join-Path $Out $name;[IO.Directory]::CreateDirectory($folder)|Out-Null
 $source=Join-Path $folder ($name+'.xlsx');[IO.File]::Copy((Join-Path (Join-Path $Root 'inputs') ($name+'.xlsx')),$source,$true)
 $settings.lastfile_BookletXlsx=$source;$obj=New-BackendObject 'BookletXlsxDialog';$errorText=$null;$messages=@()
 try{$messages=Invoke-OriginalWorker $obj 'Process1_bw_DoWork'}catch{$err=$_.Exception;while($err.InnerException){$err=$err.InnerException};$errorText=$err.ToString()}
 $Results.Add(@{id=$name;error=$errorText;messages=$messages;state=(Fields $obj);files=(Capture-Files $folder)})
}
$cases=@(
 @{id='retain-single';source='Logins';renew=$false;xml=$true;separate=$false;length=5;password=0;monitor=$false;testee=$false;reserve=$false;review=$false},
 @{id='retain-separate';source='Logins';renew=$false;xml=$true;separate=$true;length=5;password=0;monitor=$false;testee=$false;reserve=$false;review=$false},
 @{id='renew-prefixes-password-proctor';source='Logins-wide';renew=$true;xml=$true;separate=$true;length=5;password=3;monitor=$true;testee=$true;reserve=$true;review=$true},
 @{id='renew-mixed-prefixes';source='Logins-wide';renew=$true;xml=$true;separate=$false;length=5;password=0;monitor=$false;testee=$true;reserve=$false;review=$false},
 @{id='renew-no-xml';source='Logins-wide';renew=$true;xml=$false;separate=$true;length=5;password=0;monitor=$true;testee=$false;reserve=$false;review=$false}
)
foreach($case in $cases){
 $folder=Join-Path $Out $case.id;[IO.Directory]::CreateDirectory($folder)|Out-Null
 $source=Join-Path $folder 'Logins.xlsx';[IO.File]::Copy((Join-Path (Join-Path $Root 'inputs') ($case.source+'.xlsx')),$source,$true)
 $settings.lastfile_LoginXlsx=$source;$obj=New-BackendObject 'LoginsTemplateXlsxDialog';$t=$obj.GetType();$instance=[Reflection.BindingFlags]'NonPublic,Instance';$static=[Reflection.BindingFlags]'NonPublic,Static'
 $t.GetField('sourceFileName',$instance).SetValue($obj,$source);$t.GetField('renewLogins',$instance).SetValue($obj,$case.renew);$t.GetField('generateXml',$instance).SetValue($obj,$case.xml)
 foreach($pair in @(@('loginLength',$case.length),@('passwordLength',$case.password),@('addProctor',$case.monitor),@('addPrefixTestee',$case.testee),@('addPrefixPlus',$case.reserve),@('addPrefixReview',$case.review),@('separateXmlFiles',$case.separate),@('bookletName','DEMO'))){$t.GetField($pair[0],$static).SetValue($null,$pair[1])}
 $errorText=$null;$messages=@();try{
  $messages+=Invoke-OriginalWorker $obj 'Process1_bw_DoWork'
  foreach($field in @('ErrorMessages','Warnings','Testgroups')){$t.GetField($field,$instance).GetValue($obj).Clear()}
  $messages+=Invoke-OriginalWorker $obj 'Process2_bw_DoWork'
 }catch{$err=$_.Exception;while($err.InnerException){$err=$err.InnerException};$errorText=$err.ToString()}
 $Results.Add(@{id=$case.id;options=$case;error=$errorText;messages=$messages;state=(Fields $obj);files=(Capture-Files $folder)})
}
$hashes=@{};foreach($path in @((Join-Path $ToolPath 'itc-Toolbox.exe'),(Join-Path $CodePath 'IQB-Kodieren.exe'),(Join-Path $CodePath 'IQB-Scans.dll'),(Join-Path $CodePath 'IQB-Common.dll'))){$hashes[[IO.Path]::GetFileName($path)]=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()}
$inputs=@{};foreach($file in Get-ChildItem (Join-Path $Root 'inputs') -File){$inputs[$file.Name]=(Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
@{finished=[DateTime]::UtcNow.ToString('o');bits=[IntPtr]::Size*8;culture=[Threading.Thread]::CurrentThread.CurrentCulture.Name;hashes=$hashes;inputs=$inputs;inputFiles=(Capture-Files (Join-Path $Root 'inputs'));results=$Results.ToArray();method='Unchanged original dialog business workers; separate manual GUI captures recorded independently.'}|ConvertTo-Json -Depth 60|Set-Content -Encoding UTF8 (Join-Path $Out 'results.json')
Write-Output 'Native extended reference finished'
