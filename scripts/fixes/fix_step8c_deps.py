import io

path = "src/hooks/useAppointmentForm.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  }, [allDoctors, selectedSpecialiteStepper, doctorLoadsById]);

  const generateDoctorTimeSlots = useCallback((doctorId) => {"""
new = """  }, [allDoctors, selectedSpecialiteStepper, specialiteIdsWithChildren, doctorLoadsById]);

  const generateDoctorTimeSlots = useCallback((doctorId) => {"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: dépendance ajoutée")
