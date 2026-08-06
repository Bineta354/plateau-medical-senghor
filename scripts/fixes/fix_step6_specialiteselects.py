import io

# Fichier 1 : Step0PatientContext.jsx
path1 = "src/components/rendez-vous/Step0PatientContext.jsx"
with io.open(path1, "r", encoding="utf-8") as f:
    content1 = f.read()

old1 = """            {specialites.map((specialite) => (
              <option key={specialite} value={specialite}>
                {specialite}
              </option>
            ))}"""
new1 = """            {specialites.map((specialite) => (
              <option key={specialite.id} value={specialite.id}>
                {specialite.parent_id ? `— ${specialite.nom}` : specialite.nom}
              </option>
            ))}"""

if old1 not in content1:
    print("ERREUR: texte non trouvé (Step0PatientContext.jsx)")
else:
    content1 = content1.replace(old1, new1)
    with io.open(path1, "w", encoding="utf-8", newline="") as f:
        f.write(content1)
    print("OK: Step0PatientContext.jsx corrigé")

# Fichier 2 : PriseRendezVous.jsx
path2 = "src/pages/rendez-vous/PriseRendezVous.jsx"
with io.open(path2, "r", encoding="utf-8") as f:
    content2 = f.read()

old2 = """              {specialites.map((specialite, index) => (
                <option key={`specialite-${index}`} value={specialite}>{specialite}</option>
              ))}"""
new2 = """              {specialites.map((specialite) => (
                <option key={specialite.id} value={specialite.id}>{specialite.parent_id ? `— ${specialite.nom}` : specialite.nom}</option>
              ))}"""

if old2 not in content2:
    print("ERREUR: texte non trouvé (PriseRendezVous.jsx)")
else:
    content2 = content2.replace(old2, new2)
    with io.open(path2, "w", encoding="utf-8", newline="") as f:
        f.write(content2)
    print("OK: PriseRendezVous.jsx corrigé")
