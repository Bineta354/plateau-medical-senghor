import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      console.log("SPECIALITES FETCH:", data);
      setSpecialites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }

  const fetchAppointments = async (date) => {"""

new = """  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      console.log("SPECIALITES FETCH:", data);
      setSpecialites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchAppointments = async (date) => {"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: accolade de fermeture rétablie")
