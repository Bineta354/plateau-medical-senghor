import io

path = "src/lib/services.js"
with io.open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Lignes 139 à 147 (index 138 à 146) correspondent à la fonction à remplacer
start_idx = 138  # ligne 139
end_idx = 147     # ligne 147 (exclusif dans le slice, donc jusqu'à la ligne 147 incluse)

new_block = """  // Récupérer les spécialités réellement présentes en base (avec hiérarchie parent/enfant)
  async getUniqueDoctorSpecialties() {
    console.log(`[SPECIALITY_CONFIG] userService.getUniqueDoctorSpecialties() appelé`)
    const { data, error } = await supabase
      .from('specialites')
      .select('id, nom, parent_id')
      .eq('actif', true)
      .order('nom', { ascending: true })
    if (error) {
      console.error(`[SPECIALITY_CONFIG] Erreur lors de la récupération des spécialités:`, error)
      return []
    }
    console.log(`[SPECIALITY_CONFIG] Spécialités uniques récupérées`, { specialites: data })
    return data || []
  }
"""

# Vérification de sécurité : la ligne 140 doit contenir la signature de la fonction
if "getUniqueDoctorSpecialties" not in lines[139]:
    print(f"ERREUR: la ligne 140 ne correspond pas à ce qui est attendu. Contenu actuel: {lines[139]!r}")
else:
    lines[start_idx:end_idx] = [new_block]
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.writelines(lines)
    print("OK: getUniqueDoctorSpecialties corrigée (par numéro de ligne)")
