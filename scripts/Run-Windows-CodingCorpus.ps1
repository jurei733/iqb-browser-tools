param([string]$Root='C:\IQB',[string]$InputFile,[string]$OutputFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Xml.Linq
Add-Type -AssemblyName PresentationFramework
$ToolPath=Join-Path $Root 'originals\itc-ToolBox'
$CodePath=Join-Path $Root 'originals\IQB-Kodieren'
[AppDomain]::CurrentDomain.add_AssemblyResolve([ResolveEventHandler]{param($s,$e) foreach($folder in @($ToolPath,$CodePath)){$path=Join-Path $folder (([Reflection.AssemblyName]$e.Name).Name+'.dll');if(Test-Path $path){return [Reflection.Assembly]::LoadFrom($path)}};return $null})
$Code=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Kodieren.exe'))
$Common=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Common.dll'))
$Scans=[Reflection.Assembly]::LoadFrom((Join-Path $CodePath 'IQB-Scans.dll'))
[Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'Newtonsoft.Json.dll'))|Out-Null
$t=$Code.GetType('HUBerlin.IQB.Kodieren.Coding');$g=$Code.GetType('HUBerlin.IQB.Kodieren.Codings');$cl=$Code.GetType('HUBerlin.IQB.Kodieren.CaseList')
$provider=$Common.GetType('HUBerlin.IQB.Common.ZipXDocProvider')
$write=$provider.GetMethod('XDocToZipBytes',([Reflection.BindingFlags]'NonPublic,Static'))
$read=$provider.GetMethod('ZipBytesToXDoc',([Reflection.BindingFlags]'NonPublic,Static'))
$settings=$Code.GetType('HUBerlin.IQB.Kodieren.MySettings').GetProperty('Default').GetValue($null,$null)
function Model($doc){
 $root=$doc.Root;$entries=@($root.Elements('c')|ForEach-Object{@{testee=[string]$_.Attribute('tp').Value;variable=[string]$_.Attribute('v').Value;code=[string]$_.Attribute('c').Value;time=[string]$_.Attribute('tm').Value;comment=$_.Value}})
 return @{id=[string]$root.Attribute('id').Value;label=[string]$root.Attribute('label').Value;coder=[string]$root.Attribute('coder').Value;globalComment=if($root.Element('globalcomment')){$root.Element('globalcomment').Value}else{''};entries=$entries}
}
function Raw-Arguments([object[]]$Values){
 $raw=[object[]]::new($Values.Length)
 for($i=0;$i -lt $Values.Length;$i++){if($null -ne $Values[$i]){$raw[$i]=$Values[$i].PSObject.BaseObject}}
 return ,$raw
}
function ErrorText($error){$e=$error.Exception;while($e.InnerException){$e=$e.InnerException};return @{exceptionType=$e.GetType().FullName;message=$e.Message}}
$results=New-Object Collections.Generic.List[object]
foreach($case in [Newtonsoft.Json.Linq.JArray]::Parse([IO.File]::ReadAllText($InputFile))){
 $result=@{id=[string]$case['id']}
 try{
  # The constructor opens scan files; initialize only the fields used by the
  # unchanged ResultsToXDoc serializer. No GUI behavior is claimed here.
  $list=[Runtime.Serialization.FormatterServices]::GetUninitializedObject($cl)
  foreach($pair in @(@('_id',[string]$case['job']['id']),@('_label',[string]$case['job']['label']),@('_globalcomment',[string]$case['globalComment']))){$cl.GetField($pair[0],([Reflection.BindingFlags]'NonPublic,Instance')).SetValue($list,$pair[1])}
  $settings.GetType().GetProperty('codername').SetValue($settings,[string]$case['coder'],$null)
  $groups=[Activator]::CreateInstance([Collections.Generic.List``1].MakeGenericType($g))
  $lookup=@{}
  foreach($item in $case['job']['cases']){
   $testee=[string]$item['testee']
   if(!$lookup.ContainsKey($testee)){$group=[Activator]::CreateInstance($g);$g.GetField('Testee').SetValue($group,$testee);$dict=[Activator]::CreateInstance([Collections.Generic.Dictionary``2].MakeGenericType([string],$t));$g.GetField('CodingList').SetValue($group,$dict);$groups.Add($group);$lookup[$testee]=$dict}
   $coding=[Activator]::CreateInstance($t);$v=New-Object Xml.Linq.XElement ([Xml.Linq.XName]::Get('v'));$v.SetAttributeValue('id',[string]$item['variable']['id']);$t.GetProperty('XVar').SetValue($coding,$v,$null)
   $t.GetProperty('Code').SetValue($coding,[string]$item['code'],$null);$t.GetProperty('Comment').SetValue($coding,[string]$item['comment'],$null);$t.GetProperty('TimeStamp').SetValue($coding,([DateTime]$item['time'].Value),$null)
   $lookup[$testee].Add([string]$item['variable']['id'],$coding)
  }
  $cl.GetField('AllCases',([Reflection.BindingFlags]'NonPublic,Instance')).SetValue($list,$groups)
  $doc=$cl.GetMethod('ResultsToXDoc').Invoke($list,$null)
  $bytes=$write.Invoke($null,[object[]]@($doc));$result.nativeBase64=[Convert]::ToBase64String($bytes)
  $decoded=$read.Invoke($null,[object[]]@(,$bytes));$result.nativeModel=Model $decoded
  if(([string]$case['id']).StartsWith('state-')){try{
   # Reopen the saved file through the real original CaseList constructor.
   # Empty PageImageSets satisfy the job definition; no image/GUI claim.
   $definitionType=$Scans.GetType('HUBerlin.IQB.Scans.jobDef');$pageType=$Scans.GetType('HUBerlin.IQB.Scans.PageImageSet')
   $definition=[Activator]::CreateInstance($definitionType);$definition.ID=[string]$case['job']['id'];$definition.Label=[string]$case['job']['label']
   $definition.Variables=New-Object 'Collections.Generic.Dictionary[string,Xml.Linq.XElement]'
   $pageMapType=[Collections.Generic.Dictionary``2].MakeGenericType([string],$pageType)
   $definition.Testees=[Activator]::CreateInstance([Collections.Generic.Dictionary``2].MakeGenericType([string],$pageMapType))
   foreach($item in $case['job']['cases']){
    $person=[string]$item['testee'];$variable=[string]$item['variable']['id']
    if(!$definition.Variables.ContainsKey($variable)){$element=New-Object Xml.Linq.XElement ([Xml.Linq.XName]::Get('v'));$element.SetAttributeValue('id',$variable);$definition.Variables.Add($variable,$element)}
    if(!$definition.Testees.ContainsKey($person)){$definition.Testees.Add($person,[Activator]::CreateInstance($pageMapType))}
    $definition.Testees[$person].Add($variable,[Activator]::CreateInstance($pageType,(Raw-Arguments ([object[]]@($variable)))))
   }
   $folder=Join-Path ([IO.Path]::GetDirectoryName($OutputFile)) ('reopen-'+[string]$case['id']);[IO.Directory]::CreateDirectory($folder)|Out-Null
   [IO.File]::WriteAllBytes((Join-Path $folder 'saved.result'),$bytes)
   $restored=$cl.GetConstructors()[0].Invoke((Raw-Arguments ([object[]]@($definition,$folder))))
   $again=$cl.GetMethod('ResultsToXDoc').Invoke($restored,$null);$againBytes=$write.Invoke($null,[object[]]@($again));$againDecoded=$read.Invoke($null,[object[]]@(,$againBytes))
   $result.reopenedNativeModel=Model $againDecoded
   $result.reopenedNativeBase64=[Convert]::ToBase64String($againBytes)
  }catch{$result.reopenError=ErrorText $_}}
 }catch{$result.nativeError=ErrorText $_}
 if($null -ne $case['browserBase64']){try{$browserBytes=[Convert]::FromBase64String([string]$case['browserBase64']);$doc=$read.Invoke($null,[object[]]@(,$browserBytes));$result.browserModel=Model $doc}catch{$result.browserError=ErrorText $_}}
 $results.Add($result)
}
$report=@{processBits=([IntPtr]::Size*8);processArchitecture=$env:PROCESSOR_ARCHITECTURE;finished=[DateTime]::UtcNow.ToString('o');timezone=[TimeZoneInfo]::Local.Id;inputSHA256=(Get-FileHash $InputFile -Algorithm SHA256).Hash.ToLowerInvariant();codingSHA256=(Get-FileHash (Join-Path $CodePath 'IQB-Kodieren.exe') -Algorithm SHA256).Hash.ToLowerInvariant();commonSHA256=(Get-FileHash (Join-Path $CodePath 'IQB-Common.dll') -Algorithm SHA256).Hash.ToLowerInvariant();results=$results.ToArray()}
[IO.File]::WriteAllText($OutputFile,($report|ConvertTo-Json -Depth 50),(New-Object Text.UTF8Encoding($false)))
