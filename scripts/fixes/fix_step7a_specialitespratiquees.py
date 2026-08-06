import io

path = "src/lib/services.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  // Récupérer les spécialités réellement présentes en base (avec hiérarchie parent/enfant)
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
  }"""

new = """  // Récupérer uniquement les spécialités réellement pratiquées par au moins un médecin actif
  // (spécialité principale ou additionnelle), en incluant le parent si un enfant est pratiqué
  async getUniqueDoctorSpecialties() {
    console.log(`[SPECIALITY_CONFIG] userService.getUniqueDoctorSpecialties() appelé`)
    try {
      const { data: allSpecialites, error: specError } = await supabase
        .from('specialites')
        .select('id, nom, parent_id')
        .eq('actif', true)
        .order('nom', { ascending: true })
      if (specError) throw specError

      const { data: doctorsPrimary, error: docError } = await supabase
        .from('users')
        .select('specialite_id')
        .eq('role', 'doctor')
        .eq('actif', true)
      if (docError) throw docError

      const { data: doctorsAdditional, error: addError } = await supabase
        .from('medecin_specialites')
        .select('specialite_id, users:medecin_id(actif, role)')
      if (addError) throw addError

      const practicedIds = new Set()
      ;(doctorsPrimary || []).forEach((d) => {
        if (d.specialite_id) practicedIds.add(d.specialite_id)
      })
      ;(doctorsAdditional || []).forEach((d) => {
        if (d.specialite_id && d.users?.actif && d.users?.role === 'doctor') {
          practicedIds.add(d.specialite_id)
        }
      })

      const byId = Object.fromEntries((allSpecialites || []).map((s) => [s.id, s]))
      const visibleIds = new Set()
      practicedIds.forEach((id) => {
        visibleIds.add(id)
        const spec = byId[id]
        if (spec?.parent_id) visibleIds.add(spec.parent_id)
      })

      const result = (allSpecialites || []).filter((s) => visibleIds.has(s.id))
      console.log(`[SPECIALITY_CONFIG] Spécialités pratiquées récupérées`, { specialites: result })
      return result
    } catch (error) {
      console.error(`[SPECIALITY_CONFIG] Erreur lors de la récupération des spécialités pratiquées:`, error)
      return []
    }
  }"""

if old not in content:
    print("ERREUR: texte non trouvé (étape 1)")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: getUniqueDoctorSpecialties filtre maintenant sur les spécialités pratiquées")
