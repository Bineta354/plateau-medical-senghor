import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = []

# 1. fetchSpecialites: ajouter parent_id
old1 = """      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom, actif')
        .eq('actif', true)
        .order('nom', { ascending: true });

        console.log("SPECIALITES FETCH:", data);"""
new1 = """      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom, actif, parent_id')
        .eq('actif', true)
        .order('nom', { ascending: true });

        console.log("SPECIALITES FETCH:", data);"""
replacements.append(("1. fetchSpecialites parent_id", old1, new1))

# 2. specialitesDisponibles: simplifier, ne plus fusionner avec le texte des medecins
old2 = """  const specialitesDisponibles = useMemo(() => {
    const fromDoctors = doctors
      .map((doctor) => doctor.specialite?.trim())
      .filter((value) => !!value);

    const fromTable = specialites
      .map((s) => s.nom?.trim())
      .filter((value) => !!value);

    const all = Array.from(new Set([...fromTable, ...fromDoctors]));
    return all.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'accent' }));
  }, [doctors, specialites]);"""
new2 = """  const specialitesDisponibles = useMemo(() => specialites, [specialites]);

  const getSpecialiteNom = (specialiteId) => {
    if (!specialiteId) return '';
    const found = specialites.find((s) => String(s.id) === String(specialiteId));
    return found?.nom || '';
  };"""
replacements.append(("2. specialitesDisponibles simplifie", old2, new2))

# 3. availableDoctors: cascade parent/enfant au lieu de l'egalite stricte
old3 = """  const availableDoctors = useMemo(() => {
    let base = selectedSpecialiteStepper
      ? doctors.filter((doctor) => doctor.specialite === selectedSpecialiteStepper)
      : doctors;

    // Si restrictToCurrentDoctor est active, ne montrer que le medecin connecte
    if (restrictToCurrentDoctor && userProfile?.id) {
      base = base.filter((doctor) => String(doctor.id) === String(userProfile.id));
    }

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [doctors, selectedSpecialiteStepper, doctorLoadsById, restrictToCurrentDoctor, userProfile]);"""
new3 = """  const specialiteIdsWithChildren = useMemo(() => {
    if (!selectedSpecialiteStepper) return [];
    const selectedId = String(selectedSpecialiteStepper);
    const ids = [selectedId];
    specialites.forEach((s) => {
      if (String(s.parent_id) === selectedId) {
        ids.push(String(s.id));
      }
    });
    return ids;
  }, [selectedSpecialiteStepper, specialites]);

  const availableDoctors = useMemo(() => {
    let base = selectedSpecialiteStepper
      ? doctors.filter((doctor) => specialiteIdsWithChildren.includes(String(doctor.specialite_id)))
      : doctors;

    // Si restrictToCurrentDoctor est active, ne montrer que le medecin connecte
    if (restrictToCurrentDoctor && userProfile?.id) {
      base = base.filter((doctor) => String(doctor.id) === String(userProfile.id));
    }

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [doctors, selectedSpecialiteStepper, specialiteIdsWithChildren, doctorLoadsById, restrictToCurrentDoctor, userProfile]);"""
replacements.append(("3. availableDoctors cascade", old3, new3))

# 4. auto-selection specialite du medecin (par id)
old4 = """    const doctor = doctors.find(
      (doc) => String(doc.id) === String(selectedDoctorStepper)
    );
    if (doctor?.specialite) {
      setSelectedSpecialiteStepper(doctor.specialite);
    }
  }, [doctors, selectedDoctorStepper, selectedSpecialiteStepper]);"""
new4 = """    const doctor = doctors.find(
      (doc) => String(doc.id) === String(selectedDoctorStepper)
    );
    if (doctor?.specialite_id) {
      setSelectedSpecialiteStepper(String(doctor.specialite_id));
    }
  }, [doctors, selectedDoctorStepper, selectedSpecialiteStepper]);"""
replacements.append(("4. auto-selection specialite medecin", old4, new4))

# 5. restrictToCurrentDoctor: forcer specialite par id
old5 = """        // Forcer la selection de la specialite du medecin
        if (doctor.specialite && selectedSpecialiteStepper !== doctor.specialite) {
          setSelectedSpecialiteStepper(doctor.specialite);
        }"""
new5 = """        // Forcer la selection de la specialite du medecin
        if (doctor.specialite_id && selectedSpecialiteStepper !== String(doctor.specialite_id)) {
          setSelectedSpecialiteStepper(String(doctor.specialite_id));
        }"""
replacements.append(("5. restrictToCurrentDoctor specialite_id", old5, new5))

# 6. initializeModal: valeur initiale par id
old6 = """    const initialSpecialiteValue =
      editingAppointment?.medecin?.specialite || initialSpecialty || '';
    setSelectedSpecialiteStepper(initialSpecialiteValue);"""
new6 = """    const initialSpecialiteValue =
      (editingAppointment?.medecin?.specialite_id ? String(editingAppointment.medecin.specialite_id) : '') ||
      initialSpecialty ||
      '';
    setSelectedSpecialiteStepper(initialSpecialiteValue);"""
replacements.append(("6. initializeModal specialite_id", old6, new6))

# 7. Affichage confirmation etape 2: nom de specialite via lookup
old7 = """                      Dr. {selectedDoctorData.prenom} {selectedDoctorData.nom}
                      {selectedDoctorData.specialite && (
                        <span className="block text-xs text-gray-500">
                          {selectedDoctorData.specialite}
                        </span>
                      )}"""
new7 = """                      Dr. {selectedDoctorData.prenom} {selectedDoctorData.nom}
                      {getSpecialiteNom(selectedDoctorData.specialite_id) && (
                        <span className="block text-xs text-gray-500">
                          {getSpecialiteNom(selectedDoctorData.specialite_id)}
                        </span>
                      )}"""
replacements.append(("7. affichage confirmation specialite", old7, new7))

for label, old, new in replacements:
    if old not in content:
        print(f"ERREUR - non trouve: {label}")
    else:
        content = content.replace(old, new)
        print(f"OK: {label}")

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
