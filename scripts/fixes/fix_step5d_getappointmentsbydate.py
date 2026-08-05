import io

path = "src/lib/services.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """      if (doctorIds.length > 0) {
        const { data: dRows } = await supabase
          .from('users')
          .select('id, nom, prenom, specialite')
          .in('id', doctorIds);
        if (dRows) doctorMap = Object.fromEntries(dRows.map(d => [d.id, d]));
      }"""

new = """      if (doctorIds.length > 0) {
        const { data: dRows } = await supabase
          .from('users')
          .select('id, nom, prenom, specialite, specialite_id')
          .in('id', doctorIds);
        if (dRows) doctorMap = Object.fromEntries(dRows.map(d => [d.id, d]));
      }"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: specialite_id ajouté à la requête medecin dans getAppointmentsByDate")
