import io

path = "src/hooks/useRdvData.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom, actif')
        .eq('actif', true)
        .order('nom', { ascending: true });"""

new = """      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom, actif, parent_id')
        .eq('actif', true)
        .order('nom', { ascending: true });"""

if old not in content:
    print("ERREUR: le texte à remplacer n'a pas été trouvé, aucun changement effectué.")
else:
    content = content.replace(old, new)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK: fichier modifié avec succès.")
