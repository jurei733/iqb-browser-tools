param([string]$Root=$PSScriptRoot)
$ErrorActionPreference='Stop'
[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
[Threading.Thread]::CurrentThread.CurrentUICulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
$Root=[IO.Path]::GetFullPath($Root)
$Out=Join-Path $Root 'windows-results'
[IO.Directory]::CreateDirectory($Out)|Out-Null
Add-Type -AssemblyName System.Xml.Linq
Add-Type -AssemblyName PresentationFramework
$ToolPath=Join-Path $Root 'originals\itc-ToolBox'
$CodePath=Join-Path $Root 'originals\IQB-Kodieren'
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
$Tests=[Newtonsoft.Json.Linq.JArray]::Parse([IO.File]::ReadAllText((Join-Path $Root 'cases.json')))
foreach($test in $Tests){
 $id=[string]$test['id'];$method=[string]$test['method']
 try{
  $m=$Tool.GetType('iqb.testcenter.toolbox.UnitLineDataResponses').GetMethod($method,([Reflection.BindingFlags]'NonPublic,Static'))
  $content=$test['content'].ToString([Newtonsoft.Json.Formatting]::None)
  $a=if($method -eq 'setResponsesIqbStandard' -or $method -eq 'setResponsesAbi'){,(Unwrap-Arguments ([object[]]@($content)))}else{,(Unwrap-Arguments ([object[]]@($content,$null)))}
  $encoded=[Newtonsoft.Json.JsonConvert]::SerializeObject($m.Invoke($null,$a))
  $Results.Add(@{id=$id;outputJSON=$encoded})
 }catch{$err=$_.Exception;while($err.InnerException){$err=$err.InnerException};$Results.Add(@{id=$id;error=$err.ToString()})}
}
try{
 $t=$Code.GetType('HUBerlin.IQB.Kodieren.Coding');$g=$Code.GetType('HUBerlin.IQB.Kodieren.Codings')
 $group=[Activator]::CreateInstance($g);$g.GetField('Testee').SetValue($group,'001')
 $dictType=[Collections.Generic.Dictionary``2].MakeGenericType([string],$t)
 $dict=[Activator]::CreateInstance($dictType)
 foreach($item in @(@('V1','0',"ä & < > `"`r`nZeile"),@('V2','','Nur Kommentar'),@('V3','',''),@('V4','1',''))){
  $c=[Activator]::CreateInstance($t)
  $t.GetProperty('XVar').SetValue($c,[Xml.Linq.XElement]::Parse('<v id="'+$item[0]+'"/>'),$null)
  $t.GetProperty('Code').SetValue($c,$item[1],$null);$t.GetProperty('Comment').SetValue($c,$item[2],$null)
  $t.GetProperty('TimeStamp').SetValue($c,[DateTime]::new(2026,10,22,10,11,12),$null)
  $dict.Add($item[0],$c)
 }
 $g.GetField('CodingList').SetValue($group,$dict)
 $xml=@($g.GetMethod('ResultsToXML').Invoke($group,$null)|ForEach-Object{$_.ToString()})
 $Results.Add(@{id='coding-results';xml=$xml})
 $xdoc=[Xml.Linq.XDocument]::Parse('<CodingResults version="5" id="reference-codec" coder="Ref &amp; Ä" label="Referenz">'+($xml -join '')+'</CodingResults>')
 $Common.GetType('HUBerlin.IQB.Common.ZipXDocProvider').GetMethod('ZipXDocToFile').Invoke($null,(Unwrap-Arguments ([object[]]@((Join-Path $Out 'native.result'),$xdoc))))|Out-Null
}catch{$err=$_.Exception;while($err.InnerException){$err=$err.InnerException};$Results.Add(@{id='coding-results';error=$err.ToString()})}
function Run-Test([string]$id,[scriptblock]$block){
 Write-Host ('Running reference: '+$id)
 try{$value=& $block;$Results.Add(@{id=$id;output=$value})}
 catch{$err=$_.Exception;while($err.InnerException){$err=$err.InnerException};$Results.Add(@{id=$id;error=$err.ToString()})}
}
Run-Test 'toolbox-numeric-identities' {
 $dto=[Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText((Join-Path $Root 'identity.json')),$Tool.GetType('iqb.testcenter.toolbox.ResponseDTO'))
 return @{group=$dto.groupname;login=$dto.loginname;code=$dto.code;booklet=$dto.bookletname}
}
Run-Test 'coding-read-browser-result' {
 $doc=$Common.GetType('HUBerlin.IQB.Common.ZipXDocProvider').GetMethod('ZipXDocFromFile').Invoke($null,(Unwrap-Arguments ([object[]]@((Join-Path $Root 'browser.result')))))
 if(!$doc){throw 'Original codec did not read browser.result'}
 return $doc.ToString()
}
Run-Test 'coding-options' {
 $list=@()
 foreach($test in (Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'options.json')|ConvertFrom-Json)){
  $x=[Xml.Linq.XElement]::Parse($test.xml)
  $o=[Activator]::CreateInstance($Scans.GetType('HUBerlin.IQB.Scans.jobOptions'),(Unwrap-Arguments ([object[]]@($x))))
  $list+=@{id=$test.id;showScore=$o.showScore;enableComments=$o.enableComments;suppressDescription=$o.suppressDescription;training=$o.training;anonym=$o.anonym;coder=$o.codername;personPrefix=$o.persprefix}
 }
 return ,$list
}
Run-Test 'coding-jobs' {
 $jobs=$Scans.GetType('HUBerlin.IQB.Scans.ScanFactory').GetMethod('GetJobDefsFromDirectory').Invoke($null,(Unwrap-Arguments ([object[]]@((Join-Path $Root 'coding')))))
 $list=@()
 foreach($j in $jobs){
  $cases=@()
  foreach($person in $j.Testees.GetEnumerator()){
   foreach($v in $person.Value.GetEnumerator()){
    $pages=@()
    foreach($page in $v.Value){
     $f=$page.Frame
     $frame=if($f){@{x=$f.X;y=$f.Y;w=$f.Width;h=$f.Height}}else{$null}
     $bmp=$page.GetScanImage()
     $pages+=@{name=$page.GetNiceLabel();frame=$frame;width=$bmp.PixelWidth;height=$bmp.PixelHeight;dpiX=$bmp.DpiX;dpiY=$bmp.DpiY;displayWidth=$bmp.Width;displayHeight=$bmp.Height}
    }
    $cases+=@{testee=$person.Key;variable=$v.Key;pages=$pages}
   }
  }
  $list+=@{id=$j.ID;label=$j.Label;showScore=$j.Settings.showScore;enableComments=$j.Settings.enableComments;suppressDescription=$j.Settings.suppressDescription;variables=@($j.Variables.Keys);cases=$cases}
 }
 return ,$list
}
Run-Test 'coding-image-decoders' {
 $list=@();$folder=Join-Path $Out 'images';[IO.Directory]::CreateDirectory($folder)|Out-Null
 foreach($file in Get-ChildItem (Join-Path $Root 'images') -File){
  try{
   $page=[Activator]::CreateInstance($Scans.GetType('HUBerlin.IQB.Scans.PageImageFS'),(Unwrap-Arguments ([object[]]@($file.FullName))))
   $bmp=$page.GetScanImage()
   $enc=New-Object Windows.Media.Imaging.PngBitmapEncoder
   $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bmp))
   $outFile=Join-Path $folder ($file.Name+'.png');$stream=[IO.File]::Create($outFile)
   try{$enc.Save($stream)}finally{$stream.Dispose()}
   $list+=@{name=$file.Name;width=$bmp.PixelWidth;height=$bmp.PixelHeight;dpiX=$bmp.DpiX;dpiY=$bmp.DpiY;displayWidth=$bmp.Width;displayHeight=$bmp.Height}
  }catch{$list+=@{name=$file.Name;error=$_.Exception.ToString()}}
 }
 return ,$list
}
Run-Test 'toolbox-code-factory' {
 $t=$Tool.GetType('iqb.testcenter.toolbox.CodeFactory');$list=@()
 foreach($pair in @(@(2,100),@(3,200),@(4,500),@(5,2000))){
  $codes=$t.GetMethod('GetNewCodeList').Invoke($null,(Unwrap-Arguments ([object[]]@($pair[0],$pair[1]))))
  $list+=@{length=$pair[0];count=$codes.Count;distinct=@($codes|Select-Object -Unique).Count;codes=@($codes)}
 }
 return ,$list
}
Run-Test 'toolbox-wide-workbooks' {
 [Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'DocumentFormat.OpenXml.dll'))|Out-Null
 [Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'iqblib-openxml.dll'))|Out-Null
 $personType=$Tool.GetType('iqb.testcenter.toolbox.Person')
 $personListType=[Collections.Generic.List``1].MakeGenericType($personType)
 $people=[Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText((Join-Path $Root 'people.json')),$personListType)
 $store=$Tool.GetType('iqb.testcenter.toolbox.globalOutputStore')
 $store.GetMethod('clear').Invoke($null,$null)|Out-Null
 $data=$store.GetField('personDataFull').GetValue($null)
 foreach($person in $people){$data.Add($person.group+$person.login+$person.code,$person)}
 $blank=Join-Path $Out 'blank.xlsx'
 $doc=[DocumentFormat.OpenXml.Packaging.SpreadsheetDocument]::Create($blank,[DocumentFormat.OpenXml.SpreadsheetDocumentType]::Workbook)
 $part=$doc.AddWorkbookPart();$part.Workbook=New-Object DocumentFormat.OpenXml.Spreadsheet.Workbook
 $part.Workbook.InnerXml='<sheets xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />'
 $part.Workbook.Save()
 $doc.Close();$bytes=[IO.File]::ReadAllBytes($blank)
 $worker=New-Object ComponentModel.BackgroundWorker;$worker.WorkerReportsProgress=$true
 $event=[ComponentModel.DoWorkEventArgs]::new($null)
 $output=@()
 foreach($mode in @('None','Rows','Columns')){
  $config=[Activator]::CreateInstance($Tool.GetType('iqb.testcenter.toolbox.WriteXlsxConfig'))
  $config.targetXlsxFilename=Join-Path $Out ('wide-'+$mode+'.xlsx')
  $config.writeResponsesValues=$true;$config.writeResponsesStatus=$true;$config.writeResponsesCodes=$true;$config.writeResponsesScores=$true
  $config.subformMode=[Enum]::Parse($Tool.GetType('iqb.testcenter.toolbox.SubformMode'),$mode)
  $Tool.GetType('iqb.testcenter.toolbox.WriteOutputToXlsx').GetMethod('Write').Invoke($null,(Unwrap-Arguments ([object[]]@($bytes,$worker,$event,$config))))|Out-Null
  $output+=@{mode=$mode;exists=(Test-Path $config.targetXlsxFilename)}
 }
 return ,$output
}
Run-Test 'toolbox-open-browser-database' {
 $db=[Activator]::CreateInstance($Tool.GetType('iqb.testcenter.toolbox.SQLiteConnector'),(Unwrap-Arguments ([object[]]@((Join-Path $Root 'browser.sqlite'),$false))))
 try{
  $people=$db.getPeopleList();$list=@()
  foreach($id in $people.Values){$list+=($db.getPersonResponses($id))}
  return ([Newtonsoft.Json.JsonConvert]::SerializeObject($list)|ConvertFrom-Json)
 }finally{$db.CloseConnection()}
}
Run-Test 'toolbox-create-native-database' {
 $db=[Activator]::CreateInstance($Tool.GetType('iqb.testcenter.toolbox.SQLiteConnector'),(Unwrap-Arguments ([object[]]@((Join-Path $Out 'native.sqlite'),$true))))
 try{
  $personType=$Tool.GetType('iqb.testcenter.toolbox.Person');$listType=[Collections.Generic.List``1].MakeGenericType($personType)
  $people=[Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText((Join-Path $Root 'people.json')),$listType)
  foreach($person in $people){$db.addPerson($person)}
  $db.WriteDbInfoData($false)|Out-Null
  return @{people=$db.getPeopleList().Count;exists=(Test-Path (Join-Path $Out 'native.sqlite'))}
 }finally{$db.CloseConnection()}
}
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
function Invoke-Backend($obj,[string]$method){
 $worker=New-Object ComponentModel.BackgroundWorker;$worker.WorkerReportsProgress=$true;$worker.WorkerSupportsCancellation=$true
 $event=[ComponentModel.DoWorkEventArgs]::new($null)
 $obj.GetType().GetMethod($method,([Reflection.BindingFlags]'NonPublic,Instance')).Invoke($obj,(Unwrap-Arguments ([object[]]@($worker,$event))))|Out-Null
 $errorField=$obj.GetType().GetField('ErrorMessages',([Reflection.BindingFlags]'NonPublic,Instance'))
 if($errorField){$errors=$errorField.GetValue($obj);if($errors.Count){throw ([Newtonsoft.Json.JsonConvert]::SerializeObject($errors))}}
}
Run-Test 'toolbox-booklet-template' {
 $folder=Join-Path $Out 'booklets';[IO.Directory]::CreateDirectory($folder)|Out-Null
 $source=Join-Path $folder 'Booklet-Template.xlsx';[IO.File]::Copy((Join-Path $Root 'Booklet-Template.xlsx'),$source,$true)
 $settings=Get-OriginalSettings;$settings.lastfile_BookletXlsx=$source
 $obj=New-BackendObject 'BookletXlsxDialog';Invoke-Backend $obj 'Process1_bw_DoWork'
 $files=@();foreach($f in Get-ChildItem $folder -Filter 'booklet*.xml'){$files+=@{name=$f.Name;xml=[IO.File]::ReadAllText($f.FullName)}}
 return ,$files
}
Run-Test 'toolbox-csv-to-xlsx' {
 $converter=[Activator]::CreateInstance($Tool.GetType('iqb.testcenter.toolbox.transformCsv2Xlsx'),(Unwrap-Arguments ([object[]]@((Join-Path $Root 'simple.csv')))))
 $converter.ToXlsx((Join-Path $Out 'csv.xlsx'))
 return @{exists=(Test-Path (Join-Path $Out 'csv.xlsx'))}
}
Run-Test 'toolbox-review-export' {
 $listType=[Collections.Generic.List``1].MakeGenericType($Tool.GetType('iqb.testcenter.toolbox.ReviewDTO'))
 $reviews=[Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText((Join-Path $Root 'reviews.json')),$listType)
 $worker=New-Object ComponentModel.BackgroundWorker;$worker.WorkerReportsProgress=$true
 $event=[ComponentModel.DoWorkEventArgs]::new($null)
 $Tool.GetType('iqb.testcenter.toolbox.WriteReviewsToXlsx').GetMethod('Write').Invoke($null,(Unwrap-Arguments ([object[]]@([IO.File]::ReadAllBytes((Join-Path $Out 'blank.xlsx')),$worker,$event,$reviews,(Join-Path $Out 'reviews.xlsx')))))|Out-Null
 return @{exists=(Test-Path (Join-Path $Out 'reviews.xlsx'))}
}
Run-Test 'toolbox-testtaker-xml' {
 $folder=Join-Path $Out 'testtakers';[IO.Directory]::CreateDirectory($folder)|Out-Null
 $source=Join-Path $folder 'Logins.xlsx';[IO.File]::Copy((Join-Path $Root 'Logins-Beispiel.xlsx'),$source,$true)
 $settings=Get-OriginalSettings;$settings.lastfile_LoginXlsx=$source
 $obj=New-BackendObject 'LoginsTemplateXlsxDialog'
 $obj.GetType().GetField('sourceFileName',([Reflection.BindingFlags]'NonPublic,Instance')).SetValue($obj,$source)
 $flags=[Reflection.BindingFlags]'NonPublic,Static';$type=$obj.GetType()
 $type.GetField('separateXmlFiles',$flags).SetValue($null,$false)
 $type.GetField('bookletName',$flags).SetValue($null,'DEMO')
 $type.GetField('generateXml',([Reflection.BindingFlags]'NonPublic,Instance')).SetValue($obj,$true)
 Invoke-Backend $obj 'Process1_bw_DoWork'
 foreach($field in @('ErrorMessages','Warnings','Testgroups')){$obj.GetType().GetField($field,([Reflection.BindingFlags]'NonPublic,Instance')).GetValue($obj).Clear()}
 Invoke-Backend $obj 'Process2_bw_DoWork'
 $files=@();foreach($f in Get-ChildItem $folder -Filter '*.xml'){$files+=@{name=$f.Name;xml=[IO.File]::ReadAllText($f.FullName)}}
 return ,$files
}
Run-Test 'toolbox-word-original-templates' {
 $settings=Get-OriginalSettings;$settings.lastfile_LoginXlsx=Join-Path $Root 'Logins-Beispiel.xlsx';$settings.lastServerUrl='https://testcenter.example.org'
 $obj=New-BackendObject 'LoginsXlsxToDocxDialog';Invoke-Backend $obj 'Process1_bw_DoWork'
 $files=@()
 foreach($n in @(1,2)){
  $settings.lastfile_LoginDocxTemplate=Join-Path $Root ('Logins-Vorlage'+$n+'.docx')
  $settings.lastfile_LoginDocxTarget=Join-Path $Out ('logins-'+$n+'.docx')
  Invoke-Backend $obj 'Process2_bw_DoWork'
  $files+=@{template=$n;exists=(Test-Path $settings.lastfile_LoginDocxTarget)}
 }
 return ,$files
}
$hashes=@{}
foreach($p in @((Join-Path $ToolPath 'itc-Toolbox.exe'),(Join-Path $CodePath 'IQB-Kodieren.exe'),(Join-Path $CodePath 'IQB-Scans.dll'),(Join-Path $CodePath 'IQB-Common.dll'))){$hashes[[IO.Path]::GetFileName($p)]=(Get-FileHash $p -Algorithm SHA256).Hash.ToLowerInvariant()}
$report=@{finished=[DateTime]::UtcNow.ToString('o');platform=[Environment]::OSVersion.VersionString;runtime=[Environment]::Version.ToString();architecture=$env:PROCESSOR_ARCHITECTURE;culture=[Threading.Thread]::CurrentThread.CurrentCulture.Name;hashes=$hashes;results=$Results.ToArray()}
$report|ConvertTo-Json -Depth 50|Set-Content -Encoding UTF8 (Join-Path $Out 'original-windows.json')
Write-Host ('Reference run saved: '+$Out)
