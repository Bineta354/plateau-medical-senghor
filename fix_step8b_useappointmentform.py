import io

path = "src/hooks/useAppointmentForm.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = """export const useAppointmentForm = ({
  allPatients,
  allDoctors,
  appointments, // Appointments for the selected date"""
new1 = """export const useAppointmentForm = ({
  allPatients,
  allDoctors,
  specialites = [],
  appointments, // Appointments for the selected date"""

if old1 not in content:
    print("ERREUR: signature non trouvée")
else:
    content = content.replace(old1, new1)
    print("OK: specialites ajouté à la signature")

old2 = """  const availableDoctors = useMemo(() => {
    const base = selectedSpecialiteStepper
      ? allDoctors.filter((doctor) => doctor.specialite === selectedSpecialiteStepper)
      : allDoctors;

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });"""
new2 = """  const specialiteIdsWithChildren = useMemo(() => {
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
    const base = selectedSpecialiteStepper
      ? allDoctors.filter((doctor) => specialiteIdsWithChildren.includes(String(doctor.specialite_id)))
      : allDoctors;

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });"""

if old2 not in content:
    print("ERREUR: availableDoctors non trouvé")
else:
    content = content.replace(old2, new2)
    print("OK: availableDoctors corrigé avec cascade parent/enfant")

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
