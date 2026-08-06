import io

path = "src/lib/services.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """      } else if (specialite) {
        appointments = appointments.filter(apt => {
          const doctorSpecialite = apt.medecin?.specialite;
          return doctorSpecialite === specialite;
        });

        console.log("Nombre de rendez-vous après filtrage par spécialité :", appointments.length);
        console.table(appointments);
      }"""

new = """      } else if (specialite) {
        const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialite);
        appointments = appointments.filter(apt => {
          const doctorSpecialiteId = apt.medecin?.specialite_id;
          return doctorSpecialiteId != null && idsAvecEnfants.includes(doctorSpecialiteId);
        });

        console.log("Nombre de rendez-vous après filtrage par spécialité :", appointments.length);
        console.table(appointments);
      }"""

if old not in content:
    print("ERREUR: texte non trouvé (étape 3/3)")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: filtrage par spécialité corrigé dans getAppointmentsByDateAndDoctor")
