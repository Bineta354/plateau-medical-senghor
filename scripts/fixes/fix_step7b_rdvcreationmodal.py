import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Lignes 353 à 369 (index 352 à 368) correspondent à fetchSpecialites
start_idx = 352
end_idx = 369

new_block = """  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      console.log("SPECIALITES FETCH:", data);
      setSpecialites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
"""

if "const fetchSpecialites" not in lines[352]:
    print(f"ERREUR: la ligne 353 ne correspond pas à ce qui est attendu. Contenu actuel: {lines[352]!r}")
elif "};" not in lines[368] and "}" not in lines[368]:
    print(f"ERREUR: la ligne 369 ne semble pas être la fermeture attendue. Contenu actuel: {lines[368]!r}")
else:
    print(f"Ligne 369 (fermeture attendue): {lines[368]!r}")
    lines[start_idx:end_idx] = [new_block]
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.writelines(lines)
    print("OK: fetchSpecialites remplacé par numéro de ligne")
