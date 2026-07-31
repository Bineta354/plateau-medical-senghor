import io

path = "src/pages/administration/GestionMedecins.jsx"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """                  <td className="py-4 px-4 w-32">
                    <div className="flex flex-col gap-1">
                      {medecin.specialites_associees && medecin.specialites_associees.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {medecin.specialites_associees.slice(0, 2).map((spec, idx) => (
                            <span
                              key={spec.id || idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {spec.nom}
                            </span>
                          ))}
                          {medecin.specialites_associees.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              +{medecin.specialites_associees.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {medecin.specialite || 'Aucune spécialité'}
                        </span>
                      )}
                    </div>
                  </td>"""

new = """                  <td className="py-4 px-4 w-32">
                    <div className="flex flex-col gap-1">
                      {medecin.specialites?.nom || medecin.specialite ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-medical-primary bg-opacity-10 text-medical-primary border border-medical-primary border-opacity-30 w-fit">
                          {medecin.specialites?.nom || medecin.specialite}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Aucune spécialité</span>
                      )}
                      {medecin.specialites_associees && medecin.specialites_associees.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {medecin.specialites_associees
                            .filter((spec) => spec.nom !== (medecin.specialites?.nom || medecin.specialite))
                            .slice(0, 2)
                            .map((spec, idx) => (
                              <span
                                key={spec.id || idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                              >
                                {spec.nom}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </td>"""

if old not in content:
    print("ERREUR: texte non trouvé")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: colonne Spécialité corrigée (spécialité principale prioritaire)")
