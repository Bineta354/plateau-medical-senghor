import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """    alert('DEBUG handleNextStep appelé ! step=' + currentStep + ' specialite=' + selectedSpecialiteStepper + ' patient=' + formData.patient_id + ' doctors=' + availableDoctors.length);
    if (event) event.preventDefault();"""
new = """    if (event) event.preventDefault();"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: alert de debug retiré")
