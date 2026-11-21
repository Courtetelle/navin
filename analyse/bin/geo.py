"""Repères géographiques (consigne de Corban du 9/11/2026) : situer chaque structure décrite (thalweg, dorsale, centre de
pression, goutte froide, jet...) par rapport à un lieu connu : « au-dessus de Tolède », « 500 km à l'ouest de Vigo ».
Usage en Python : from geo import situer ; situer(44.75,-20) -> 'à 800 km à l'ouest de La Corogne'
En ligne de commande : python3 -I bin/geo.py 44.75 -20"""
import math, sys
# (nom, lat, lon, préposition « au-dessus de » / « sur »). Villes, caps et îles d'Europe, d'Afrique du Nord et de l'Atlantique Nord.
P=[("Saint-Malo",48.65,-2.02),("Brest",48.39,-4.49),("Cherbourg",49.64,-1.62),("Paris",48.86,2.35),("Lyon",45.76,4.84),("Bordeaux",44.84,-0.58),
   ("Toulouse",43.60,1.44),("Marseille",43.30,5.37),("Toulon",43.10,5.93),("Hyères",43.12,6.13),("Saint-Tropez",43.27,6.64),("Nice",43.70,7.27),("Nantes",47.22,-1.55),("Lille",50.63,3.06),("Strasbourg",48.58,7.75),("Genève",46.20,6.14),
   ("Morges",46.51,6.50),("Zurich",47.37,8.54),("Milan",45.46,9.19),("Rome",41.90,12.50),("Naples",40.85,14.27),("Venise",45.44,12.33),
   ("Ajaccio",41.93,8.74),("Cagliari",39.22,9.12),("Palerme",38.12,13.36),("Vienne",48.21,16.37),("Munich",48.14,11.58),("Berlin",52.52,13.40),
   ("Hambourg",53.55,9.99),("Francfort",50.11,8.68),("Prague",50.08,14.44),("Varsovie",52.23,21.01),("Budapest",47.50,19.04),("Belgrade",44.79,20.45),
   ("Bucarest",44.43,26.10),("Athènes",37.98,23.73),("Istanbul",41.01,28.98),("Ankara",39.93,32.86),("Kiev",50.45,30.52),("Moscou",55.76,37.62),
   ("Saint-Pétersbourg",59.93,30.34),("Helsinki",60.17,24.94),("Stockholm",59.33,18.07),("Oslo",59.91,10.75),("Bergen",60.39,5.32),
   ("Trondheim",63.43,10.40),("Tromsø",69.65,18.96),("Copenhague",55.68,12.57),("Amsterdam",52.37,4.90),("Bruxelles",50.85,4.35),
   ("Londres",51.51,-0.13),("Plymouth",50.37,-4.14),("Manchester",53.48,-2.24),("Édimbourg",55.95,-3.19),("Aberdeen",57.15,-2.09),
   ("Shetland",60.30,-1.30),("Dublin",53.35,-6.26),("Cork",51.90,-8.47),("Galway",53.27,-9.05),("Reykjavik",64.15,-21.94),("îles Féroé",62.0,-6.8),
   ("Madrid",40.42,-3.70),("Tolède",39.86,-4.02),("Séville",37.39,-5.98),("Barcelone",41.39,2.17),("Valence",39.47,-0.38),("Bilbao",43.26,-2.93),
   ("Vigo",42.24,-8.72),("La Corogne",43.36,-8.41),("Lisbonne",38.72,-9.14),("Porto",41.15,-8.61),("Gibraltar",36.14,-5.35),("Palma de Majorque",39.57,2.65),
   ("Rabat",34.02,-6.84),("Casablanca",33.57,-7.59),("Alger",36.75,3.06),("Tunis",36.81,10.18),("Tripoli",32.89,13.19),("Le Caire",30.04,31.24),
   ("Açores",38.7,-27.2),("Madère",32.75,-16.95),("Canaries",28.3,-15.6),("Saint-Jean de Terre-Neuve",47.56,-52.71),("Halifax",44.65,-63.57),
   ("Boston",42.36,-71.06),("New York",40.71,-74.01),("Bermudes",32.3,-64.8),("Nuuk",64.18,-51.69),("cap Farewell (Groenland)",59.77,-43.9),
   ("Spitzberg",78.22,15.65),("Mourmansk",68.97,33.08),("Arkhangelsk",64.54,40.54),("Ekaterinbourg",56.84,60.61),("Tbilissi",41.72,44.79),
   ("Téhéran",35.69,51.39),("Bagdad",33.31,44.37),("Riyad",24.71,46.68),("Tel-Aviv",32.08,34.78),("Chypre",35.0,33.2),("Crète",35.24,24.81),
   ("Malte",35.90,14.51),("Tamanrasset",22.79,5.53),("Nouadhibou",20.94,-17.04)]
DIRS=['au nord','au nord-est',"à l'est",'au sud-est','au sud','au sud-ouest',"à l'ouest",'au nord-ouest']
def dist(a,b,c,d):
    a,b,c,d=map(math.radians,(a,b,c,d))
    return 6371*2*math.asin(math.sqrt(math.sin((c-a)/2)**2+math.cos(a)*math.cos(c)*math.sin((d-b)/2)**2))
def cap(a,b,c,d):
    a,b,c,d=map(math.radians,(a,b,c,d)); y=math.sin(d-b)*math.cos(c); x=math.cos(a)*math.sin(c)-math.sin(a)*math.cos(c)*math.cos(d-b)
    return (math.degrees(math.atan2(y,x))+360)%360
DE={"Açores":"des Açores","Canaries":"des Canaries","Bermudes":"des Bermudes","Shetland":"des Shetland","îles Féroé":"des îles Féroé",
    "Spitzberg":"du Spitzberg","Crète":"de la Crète","Le Caire":"du Caire","cap Farewell (Groenland)":"du cap Farewell (Groenland)","Halifax":"d'Halifax"}
def de(n):
    if n in DE: return DE[n]
    if n.startswith('le '): return 'du '+n[3:]
    if n.startswith('cap '): return 'du '+n
    return ("d'" if n[0].lower() in 'aeiouéèêîôâ' else 'de ')+n
def situer(lat,lon,lieux=None):
    """Phrase courte : « au-dessus de Tolède » (< 60 km) sinon « à 500 km à l'ouest de Vigo » (distance arrondie)."""
    L=sorted(((dist(la,lo,lat,lon),n,la,lo) for n,la,lo in (lieux or P)))
    d,n,la,lo=L[0]
    if d<60: return 'au-dessus '+de(n)
    r=50 if d<500 else 100
    dd=int(round(d/r)*r)
    txt=f"à {dd} km {DIRS[int(((cap(la,lo,lat,lon)+22.5)%360)//45)]} {de(n)}"
    if d>=400 and lieux is None:   # loin de tout : ajouter un repère européen connu (ex. « soit 1000 km à l'ouest de La Corogne »)
        E=[q for q in P if 35<=q[1]<=72 and -10<=q[2]<=40 and q[0]!=n]
        d2,n2,la2,lo2=min((dist(la,lo,lat,lon),q,la,lo) for q,la,lo in E)
        if d2<=1.6*d and d2<=1500:
            txt+=f", soit {int(round(d2/100)*100)} km {DIRS[int(((cap(la2,lo2,lat,lon)+22.5)%360)//45)]} {de(n2)}"
    return txt
if __name__=='__main__': print(situer(float(sys.argv[1]),float(sys.argv[2])))

# Repères de l'échelle locale (≈ 70 km) : à 60 km près, « au-dessus de Saint-Malo » ne dit rien dans la baie.
LOCAUX=[("Saint-Quay-Portrieux",48.652,-2.831),("Bréhat",48.85,-3.0),("Paimpol",48.78,-3.05),("Binic",48.60,-2.82),("Saint-Brieuc",48.53,-2.76),
        ("Erquy",48.63,-2.47),("cap Fréhel",48.685,-2.32),("le Grand Léjon",48.742,-2.658),("Plouha",48.68,-2.93),("Saint-Cast",48.63,-2.25),
        ("Porquerolles",43.00,6.20),("Port-Cros",43.01,6.39),("l'île du Levant",43.03,6.47),("Giens",43.04,6.13),("Hyères",43.12,6.13),
        ("Toulon",43.10,5.93),("Saint-Mandrier",43.08,5.93),("Le Lavandou",43.14,6.37),("cap Bénat",43.09,6.36),("Sanary",43.12,5.80),
        ("Rolle",46.46,6.34),("Nyon",46.38,6.24),("Morges",46.51,6.50),("Lausanne",46.51,6.63),("Thonon",46.37,6.48),("Évian",46.40,6.59),
        ("Yvoire",46.37,6.33),("Genève",46.20,6.15)]
def situer_local(lat,lon):
    L=sorted(((dist(la,lo,lat,lon),n,la,lo) for n,la,lo in LOCAUX)); d,n,la,lo=L[0]
    if d>40: return situer(lat,lon)
    if d<3: return 'près '+de(n)
    return f"à {int(round(d/5)*5) or 3} km {DIRS[int(((cap(la,lo,lat,lon)+22.5)%360)//45)]} {de(n)}"
