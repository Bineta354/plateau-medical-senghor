import io

path = "src/hooks/useRdvData.js"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """import { supabase } from '../lib/supabase';"""
new = """import { supabase } from '../lib/supabase';
import { userService } from '../lib/services';"""

if old not in content:
    print("ERREUR: import non trouvé")
else:
    content = content.replace(old, new, 1)
    print("OK: import userService ajouté")

old2 = """  const fetchSpecialites = async () => {
    try {
      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom, actif, parent_id')
        .eq('actif', true)
        .order('nom', { ascending: true });
      if (error) throw error;
      setSpecialites(Array.isArray(data) ? data : []);
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des spécialités:', e);
      setSpecialites([]);
      return [];
    }
  };"""
new2 = """  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      setSpecialites(Array.isArray(data) ? data : []);
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des spécialités:', e);
      setSpecialites([]);
      return [];
    }
  };"""

if old2 not in content:
    print("ERREUR: fetchSpecialites non trouvé")
else:
    content = content.replace(old2, new2)
    print("OK: fetchSpecialites branché sur userService")

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
