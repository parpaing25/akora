<?php
// akora.fonenako.mg/api/env.php
// Chargeur d'environnement commun aux scripts API (repris de Fonenako, adapte a Akora).
//
// Sur o2switch (mutualisé), getenv() ne voit que les SetEnv Apache — et on ne
// veut AUCUN secret dans .htaccess ni dans le repo. Les secrets vivent dans
// /home2/<login>/.env_akora (hors webroot, hors git, survit aux deploys FTP
// qui n'écrasent que le docroot). Format : une ligne KEY=VALUE par secret,
// lignes vides et commentaires (#) ignorés.
//
// Usage : require_once __DIR__ . '/env.php';  (en tête de script, avant getenv)

function ak_load_env(): void {
  static $loaded = false;
  if ($loaded) return;
  $loaded = true;

  // Candidats : $HOME/.env_akora, sinon le parent du docroot
  // (docroot = /home2/<login>/akora.fonenako.mg → parent = /home2/<login>).
  $candidates = [];
  $home = getenv('HOME');
  if ($home) $candidates[] = rtrim($home, '/') . '/.env_akora';
  $candidates[] = dirname(dirname(__DIR__)) . '/.env_akora';

  foreach ($candidates as $path) {
    if (!is_readable($path)) continue;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) continue;
    foreach ($lines as $line) {
      $line = trim($line);
      if ($line === '' || $line[0] === '#') continue;
      $pos = strpos($line, '=');
      if ($pos === false) continue;
      $key = trim(substr($line, 0, $pos));
      $val = trim(substr($line, $pos + 1));
      // Retirer d'éventuels guillemets autour de la valeur.
      if (strlen($val) >= 2 && ($val[0] === '"' || $val[0] === "'") && substr($val, -1) === $val[0]) {
        $val = substr($val, 1, -1);
      }
      if ($key === '') continue;
      // Ne jamais écraser une variable déjà définie (SetEnv prioritaire).
      if (getenv($key) === false || getenv($key) === '') {
        putenv($key . '=' . $val);
        $_ENV[$key] = $val;
      }
    }
    return; // premier fichier lisible trouvé = le bon
  }
}

ak_load_env();
