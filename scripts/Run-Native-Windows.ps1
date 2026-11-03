param([string]$Root)
$ErrorActionPreference='Stop';$Root=[IO.Path]::GetFullPath($Root)
if($env:PROCESSOR_ARCHITECTURE -ne 'AMD64'){throw 'This reference job requires a Windows x64 host, not ARM emulation.'}
$provenance=Get-Content -Raw 'PROVENANCE.json'|ConvertFrom-Json
foreach($package in $provenance.packages.PSObject.Properties){
 $folder=Join-Path $Root ('originals\'+$package.Name);New-Item -ItemType Directory -Force $folder|Out-Null
 foreach($file in $package.Value.files){
  $uri=[Uri]$file.url;if($uri.Scheme -ne 'https' -or $uri.Host -ne 'www2.iqb.hu-berlin.de'){throw 'Unexpected original download origin'}
  $path=Join-Path $folder $file.path;New-Item -ItemType Directory -Force ([IO.Path]::GetDirectoryName($path))|Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri $file.url -OutFile $path
  if((Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw ('Original SHA mismatch: '+$file.path)}
 }
}
& tzutil.exe /s 'W. Europe Standard Time';if($LASTEXITCODE){throw 'Could not set the reference timezone'}
$json=Join-Path $Root 'originals\itc-ToolBox\Newtonsoft.Json.dll'
foreach($bits in @(32,64)){
 $framework=if($bits -eq 32){'Framework'}else{'Framework64'};$target=if($bits -eq 32){'x86'}else{'x64'}
 $exe=Join-Path $Root ('reference-'+$bits+'.exe');$compiler=Join-Path $env:WINDIR ('Microsoft.NET\'+$framework+'\v4.0.30319\csc.exe')
 & $compiler /nologo ('/platform:'+$target) ('/out:'+$exe) ('/reference:'+$json) 'scripts\WindowsPrecisionReference.cs'
 if($LASTEXITCODE){throw 'Reference harness compilation failed'}
 & $exe $Root (Join-Path $Root 'inputs.json') (Join-Path $Root ('native-'+$bits+'.json')) 'native-windows-x64-host'
 if($LASTEXITCODE){throw 'Original reference execution failed'}
}
& 'scripts\Run-Windows-CodingCorpus.ps1' -Root $Root -InputFile (Join-Path $Root 'coding-inputs.json') -OutputFile (Join-Path $Root 'native-coding.json')
$bundle=@{runId=$env:GITHUB_RUN_ID;commit=$env:GITHUB_SHA;inputsSHA256=(Get-FileHash (Join-Path $Root 'inputs.json') -Algorithm SHA256).Hash.ToLowerInvariant();captures=@{}}
foreach($name in @('native-32','native-64','native-coding')){$bundle.captures[$name]=Get-Content -Raw (Join-Path $Root ($name+'.json'))|ConvertFrom-Json}
$path=Join-Path $Root 'bundle.json';[IO.File]::WriteAllText($path,($bundle|ConvertTo-Json -Depth 80),(New-Object Text.UTF8Encoding($false)))
# Synthetic references only. GZip preserves raw JSON while keeping the job log
# small enough for authenticated retrieval without granting repository writes.
$memory=New-Object IO.MemoryStream;$zip=New-Object IO.Compression.GZipStream($memory,[IO.Compression.CompressionMode]::Compress,$true)
$bytes=[IO.File]::ReadAllBytes($path);$zip.Write($bytes,0,$bytes.Length);$zip.Dispose()
Write-Output ('IQB_NATIVE_GZIP:'+ [Convert]::ToBase64String($memory.ToArray()));$memory.Dispose()
Write-Output ('IQB_NATIVE_SHA256:'+ (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant())
