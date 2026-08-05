import io

path = "src/pages/rendez-vous/PriseRendezVousPage.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  } = useAppointmentForm({
    allPatients,
    allDoctors,
    appointments,"""
new = """  } = useAppointmentForm({
    allPatients,
    allDoctors,
    specialites,
    appointments,"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: specialites passé à useAppointmentForm")
