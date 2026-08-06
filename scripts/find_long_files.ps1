# find_long_files.ps1

# Ignorer les erreurs lors de la lecture de fichiers (par exemple, les fichiers binaires)
$ErrorActionPreference = 'SilentlyContinue'

# Définir les extensions de fichiers texte à vérifier
$textContentExtensions = @(
    ".txt", ".md", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json", ".sql",
    ".py", ".java", ".cs", ".go", ".rb", ".php", ".sh", ".ps1", ".xml", ".yml",
    ".yaml", ".env", ".config", ".mjs", ".cjs", ".toml", "eslint.config.js"
)

# Obtenir tous les fichiers de manière récursive, en excluant les répertoires volumineux/binaires courants
$excludedDirs = "node_modules", ".git", "dist", "build", ".vscode", "public", "backup_startup_optimization"
$files = Get-ChildItem -Recurse -File | Where-Object { $_.DirectoryName -notmatch (($excludedDirs | ForEach-Object {[regex]::Escape($_)}) -join "|") }

$longFiles = @()

foreach ($file in $files) {
    if ($textContentExtensions -contains $file.Extension -or $file.Name -in $textContentExtensions) {
        # Compter les lignes. .Length est efficace car Get-Content lit les lignes dans un tableau.
        $lineCount = (Get-Content $file.FullName).Length
        if ($lineCount -gt 1000) {
            $longFiles += $file.FullName
        }
    }
}

# Créer le rapport Markdown
$reportContent = "# Rapport : Fichiers de plus de 1000 lignes`n`n"
if ($longFiles.Count -eq 0) {
    $reportContent += "Aucun fichier de plus de 1000 lignes n'a été trouvé.`n"
} else {
    $reportContent += "Trouvé $($longFiles.Count) fichier(s) de plus de 1000 lignes:`n`n"
    foreach ($filePath in $longFiles) {
        # Rendre le chemin relatif à la racine du projet pour une sortie plus propre
        $relativePath = Resolve-Path -Path $filePath -Relative
        $reportContent += "- `$relativePath`" + "`n"
    }
}

# Écrire le rapport dans un fichier Markdown
Set-Content -Path "FILES_OVER_1000_LINES.md" -Value $reportContent

Write-Host "Script terminé. Rapport généré dans FILES_OVER_1000_LINES.md"
