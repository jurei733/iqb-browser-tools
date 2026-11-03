param([string]$Root='C:\IQB',[string]$InputFile,[string]$OutputFile,[string]$PipelineFile)
$ErrorActionPreference='Stop'
[Threading.Thread]::CurrentThread.CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
[Threading.Thread]::CurrentThread.CurrentUICulture=[Globalization.CultureInfo]::GetCultureInfo('de-DE')
$ToolPath=Join-Path $Root 'originals\itc-ToolBox'
[AppDomain]::CurrentDomain.add_AssemblyResolve([ResolveEventHandler]{param($s,$e) $path=Join-Path $ToolPath (([Reflection.AssemblyName]$e.Name).Name+'.dll');if(Test-Path $path){return [Reflection.Assembly]::LoadFrom($path)};return $null})
$Tool=[Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'itc-Toolbox.exe'))
[Reflection.Assembly]::LoadFrom((Join-Path $ToolPath 'Newtonsoft.Json.dll'))|Out-Null
$tests=[Newtonsoft.Json.Linq.JArray]::Parse([IO.File]::ReadAllText($InputFile))
$results=New-Object Collections.Generic.List[object]
foreach($test in $tests){
 $id=[string]$test['id'];$method=[string]$test['method'];$content=[string]$test['contentJSON']
 try{
  $m=$Tool.GetType('iqb.testcenter.toolbox.UnitLineDataResponses').GetMethod($method,([Reflection.BindingFlags]'NonPublic,Static'))
  $invokeValues=if($method -eq 'setResponsesIqbStandard' -or $method -eq 'setResponsesAbi'){,[object[]]@($content)}else{,[object[]]@($content,$null)}
  $output=$m.Invoke($null,$invokeValues)
  $results.Add(@{id=$id;outputJSON=[Newtonsoft.Json.JsonConvert]::SerializeObject($output)})
 }catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};$results.Add(@{id=$id;exceptionType=$e.GetType().FullName;message=$e.Message})}
}
$pipelineResults=New-Object Collections.Generic.List[object]
if($PipelineFile){foreach($case in [Newtonsoft.Json.Linq.JArray]::Parse([IO.File]::ReadAllText($PipelineFile))){
 try{$dto=[Newtonsoft.Json.JsonConvert]::DeserializeObject($case['dto'].ToString([Newtonsoft.Json.Formatting]::None),$Tool.GetType('iqb.testcenter.toolbox.ResponseDTO'));$method=$Tool.GetType('iqb.testcenter.toolbox.UnitLineDataResponses').GetMethod('fromTestcenterAPI');$output=$method.Invoke($null,[object[]]@($dto));$pipelineResults.Add(@{id=[string]$case['id'];outputJSON=[Newtonsoft.Json.JsonConvert]::SerializeObject($output)})}
 catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};$pipelineResults.Add(@{id=[string]$case['id'];exceptionType=$e.GetType().FullName;message=$e.Message})}
}}
$report=@{processBits=([IntPtr]::Size*8);processArchitecture=$env:PROCESSOR_ARCHITECTURE;timezone=[TimeZoneInfo]::Local.Id;finished=[DateTime]::UtcNow.ToString('o');platform=[Environment]::OSVersion.VersionString;runtime=[Environment]::Version.ToString();culture=[Threading.Thread]::CurrentThread.CurrentCulture.Name;inputSHA256=(Get-FileHash $InputFile -Algorithm SHA256).Hash.ToLowerInvariant();assemblySHA256=(Get-FileHash (Join-Path $ToolPath 'itc-Toolbox.exe') -Algorithm SHA256).Hash.ToLowerInvariant();results=$results.ToArray();pipelineResults=$pipelineResults.ToArray();pipelineInputSHA256=if($PipelineFile){(Get-FileHash $PipelineFile -Algorithm SHA256).Hash.ToLowerInvariant()}else{$null}}
[IO.File]::WriteAllText($OutputFile,($report|ConvertTo-Json -Depth 50),(New-Object Text.UTF8Encoding($false)))
