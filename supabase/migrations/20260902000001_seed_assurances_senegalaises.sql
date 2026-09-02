-- Assurances et organismes de couverture couramment rencontres au Senegal.
-- L'insertion est idempotente afin de pouvoir rejouer la migration sans doublons.
INSERT INTO public.assurances (
  nom,
  description,
  type_assurance,
  taux_remboursement,
  ordre_affichage,
  actif
)
SELECT nom, description, type_assurance, taux_remboursement, ordre_affichage, true
FROM (
  VALUES
    ('CMU Senegal', 'Couverture maladie universelle du Senegal', 'securite_sociale', 0.00, 10),
    ('IPM', 'Institution de prevoyance maladie', 'mutuelle', 0.00, 20),
    ('SUNU Assurances Senegal', 'Compagnie d assurance presente au Senegal', 'privee', 0.00, 30),
    ('NSIA Assurances Senegal', 'Compagnie d assurance presente au Senegal', 'privee', 0.00, 40),
    ('SanlamAllianz Senegal', 'Compagnie d assurance presente au Senegal', 'privee', 0.00, 50),
    ('ASKIA Assurances', 'Compagnie d assurance presente au Senegal', 'privee', 0.00, 60),
    ('Wafa Assurance Senegal', 'Compagnie d assurance presente au Senegal', 'privee', 0.00, 70),
    ('Mutuelle de sante communautaire', 'Mutuelle de sante a parametrer selon le contrat', 'mutuelle', 0.00, 80)
) AS nouveaux(nom, description, type_assurance, taux_remboursement, ordre_affichage)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.assurances existante
  WHERE lower(trim(existante.nom)) = lower(trim(nouveaux.nom))
);
