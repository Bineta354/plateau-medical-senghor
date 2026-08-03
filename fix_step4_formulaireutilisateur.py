import io

path = "src/pages/administration/FormulaireUtilisateur.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  // Filtrer les spécialités dentaires
  const getDentalSpecialites = () => {
    const dentalSpecialiteIds = [12, 17, 16, 14, 15, 18, 19, 13]; // IDs des spécialités dentaires
    return specialites.filter(s => dentalSpecialiteIds.includes(s.id));
  };"""

new = """  // Filtre les spécialités dentaires uniquement si ce déploiement le demande
  // (cabinet principal = true, cabinets non-dentaires comme Ngor = false)
  const getDentalSpecialites = () => {
    const filterDental = import.meta.env.VITE_FILTER_DENTAL_SPECIALITES === 'true';
    if (!filterDental) return specialites;
    const dentalSpecialiteIds = [12, 17, 16, 14, 15, 18, 19, 13]; // IDs des spécialités dentaires (cabinet principal)
    return specialites.filter(s => dentalSpecialiteIds.includes(s.id));
  };"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: filtre rendu conditionnel")
