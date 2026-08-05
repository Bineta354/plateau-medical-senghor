path = "src/components/secretary/SecretaryDashboard.jsx"

with open(path, "rb") as f:
    lines = f.read().decode("utf-8").splitlines(keepends=True)

idx = None
for i, line in enumerate(lines):
    if "if (userProfile?.tenant_id) {" in line:
        idx = i
        break

if idx is None:
    print("Ligne non trouvee.")
else:
    print("Contexte actuel (10 lignes):")
    for i in range(idx, min(idx+10, len(lines))):
        print(i, repr(lines[i]))
