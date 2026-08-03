import io

path = "src/components/rendez-vous/Step0PatientContext.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """            {specialites.map((specialite) => (
              <option key={specialite.id} value={specialite.id}>
                {specialite.parent_id ? `— ${specialite.nom}` : specialite.nom}
              </option>
            ))}"""

new = """            {specialites
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
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: regroupement parent/enfant ajouté dans Step0PatientContext.jsx")
