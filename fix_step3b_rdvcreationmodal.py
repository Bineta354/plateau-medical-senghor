import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = []

old3 = """  const availableDoctors = useMemo(() => {
    let base = selectedSpecialiteStepper
      ? doctors.filter((doctor) => doctor.specialite === selectedSpecialiteStepper)
      : doctors;

    // Si restrictToCurrentDoctor est activé, ne montrer que le médecin connecté
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

    // Si restrictToCurrentDoctor est activé, ne montrer que le médecin connecté
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

old5 = """        // Forcer la sélection de la spécialité du médecin
        if (doctor.specialite && selectedSpecialiteStepper !== doctor.specialite) {
          setSelectedSpecialiteStepper(doctor.specialite);
        }"""
new5 = """        // Forcer la sélection de la spécialité du médecin
        if (doctor.specialite_id && selectedSpecialiteStepper !== String(doctor.specialite_id)) {
          setSelectedSpecialiteStepper(String(doctor.specialite_id));
        }"""
replacements.append(("5. restrictToCurrentDoctor specialite_id", old5, new5))

for label, old, new in replacements:
    if old not in content:
        print(f"ERREUR - non trouvé: {label}")
    else:
        content = content.replace(old, new)
        print(f"OK: {label}")

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
