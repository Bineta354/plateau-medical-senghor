path = "src/components/secretary/SecretaryDashboard.jsx"

with open(path, "rb") as f:
    content = f.read().decode("utf-8")

old = "const { userProfile, loading: userProfileLoading } = useUserProfile();"
new = "const { profile: userProfile, isLoading: userProfileLoading } = useUserProfile();"

count = content.count(old)
if count != 1:
    print(f"Trouve {count} fois, verifie manuellement.")
else:
    content = content.replace(old, new, 1)
    with open(path, "wb") as f:
        f.write(content.encode("utf-8"))
    print("Correctif applique avec succes.")
