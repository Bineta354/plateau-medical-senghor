import io

path = "src/components/rendez-vous/RdvCreationModal.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """  const handleNextStep = async (event) => {
    if (event) event.preventDefault();"""

new = """  const handleNextStep = async (event) => {
    console.log('🟢 [DEBUG] handleNextStep appelé, currentStep:', currentStep, 'selectedSpecialiteStepper:', selectedSpecialiteStepper, 'formData.patient_id:', formData.patient_id, 'manualDate:', manualDate, 'availableDoctors.length:', availableDoctors.length);
    if (event) event.preventDefault();"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: log de debug ajouté")
