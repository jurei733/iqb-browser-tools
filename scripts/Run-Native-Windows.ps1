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
Write-Output 'Original downloads verified against PROVENANCE.json'
& tzutil.exe /s 'W. Europe Standard Time';if($LASTEXITCODE){throw 'Could not set the reference timezone'}
$json=Join-Path $Root 'originals\itc-ToolBox\Newtonsoft.Json.dll'
foreach($bits in @(32,64)){
 $framework=if($bits -eq 32){'Framework'}else{'Framework64'};$target=if($bits -eq 32){'x86'}else{'x64'}
 $exe=Join-Path $Root ('reference-'+$bits+'.exe');$compiler=Join-Path $env:WINDIR ('Microsoft.NET\'+$framework+'\v4.0.30319\csc.exe')
 & $compiler /nologo ('/platform:'+$target) ('/out:'+$exe) ('/reference:'+$json) 'scripts\WindowsPrecisionReference.cs'
 if($LASTEXITCODE){throw 'Reference harness compilation failed'}
 Write-Output ('Capturing Toolbox in '+$bits+'-bit process')
 & $exe $Root (Join-Path $Root 'inputs.json') (Join-Path $Root ('native-'+$bits+'.json')) 'native-windows-x64-host' (Join-Path $Root 'pipeline-inputs.json') (Join-Path $Root 'numeric-inputs.json')
 if($LASTEXITCODE){throw 'Original reference execution failed'}
}
Write-Output 'Capturing CodingResults in an isolated Windows PowerShell process'
& "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -File (Join-Path (Get-Location) 'scripts\Run-Windows-CodingCorpus.ps1') -Root $Root -InputFile (Join-Path $Root 'coding-inputs.json') -OutputFile (Join-Path $Root 'native-coding.json')
if($LASTEXITCODE){throw 'Original CodingResults capture failed'}
Write-Output 'Original captures complete'
