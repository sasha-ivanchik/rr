const cmd = 'powershell.exe';

const psCmd = `
$proc = Start-Process `
  -FilePath "${openfinPath}" `
  -ArgumentList @(
    "--config=${confUrl}",
    "--disable-gpu"
  ) `
  -WorkingDirectory "${process.cwd()}" `
  -WindowStyle Normal `
  -PassThru;`

Write-Output $proc.Id`;

const args = [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  psCmd
];

const ps = spawn(cmd, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: false,        // 🔴 ОБЯЗАТЕЛЬНО
  env: { ...process.env }    // 🔴 ОБЯЗАТЕЛЬНО
});
