import io

path = "src/pages/rendez-vous/PriseRendezVousPage.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """              <option value="">Toutes les spécialités</option>
              {specialites.map((specialite) => (
                <option key={specialite} value={specialite}>
                  {specialite}
                </option>
              ))}"""

new = """              <option value="">Toutes les spécialités</option>
              {specialites
                .filter((s) => !s.parent_id)
                .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }))
                .flatMap((parent) => {
                  const children = specialites
                    .filter((s) => s.parent_id === parent.id)
                    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));
                  return [
                    <option key={parent.id} value={parent.id}>{parent.nom}</option>,
                    ...children.map((child) => (
                      <option key={child.id} value={child.id}>{'— ' + child.nom}</option>
                    ))
                  ];
                })}"""

if old not in content:
    print("ERREUR: texte non trouvé (étape 2/3)")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: select spécialité corrigé dans PriseRendezVousPage.jsx")
