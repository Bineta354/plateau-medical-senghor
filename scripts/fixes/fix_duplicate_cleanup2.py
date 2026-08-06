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
    expected = [
        "    if (userProfile?.tenant_id) {\r\n",
        "      fetchDoctors().finally(() => setLoading(false));\r\n",
        "    } else {\r\n",
        "      setLoading(false);\r\n",
        "    }\r\n",
        "      setLoading(false);\r\n",
        "    }\r\n",
    ]
    actual = lines[idx:idx+7]
    if actual != expected:
        print("Contenu different de ce qui est attendu, rien change.")
        for l in actual:
            print(repr(l))
    else:
        # Retirer les 2 lignes en trop (indices idx+5 et idx+6 dans le fichier)
        del lines[idx+5:idx+7]
        with open(path, "wb") as f:
            f.write("".join(lines).encode("utf-8"))
        print("Doublon retire avec succes.")
