const stratagems = [
    // Mission
    {name: "Dark Fluid Vessel", img: "mission/vessel", code: "wadsww"},
    {name: "Eagle Rearm", img: "mission/eagle", code: "wwawd"},
    {name: "Hellbomb", img: "mission/hellbomb", code: "swaswdsw"},
    {name: "Hive Breaker Drill", img: "mission/drill", code: "awadss"},
    {name: "Orbital Illumination Flare", img: "mission/flare", code: "ddaa"},
    {name: "Prospecting Drill", img: "mission/drill", code: "ssadss"},
    {name: "Reinforce", img: "mission/reinforce", code: "wsdaw"},
    {name: "Resupply", img: "mission/resupply", code: "sswd"},
    {name: "SEAF Artillery", img: "mission/artillery", code: "dwws"},
    {name: "Seismic Probe", img: "mission/probe", code: "wwadss"},
    {name: "SoS Beacon", img: "mission/sos", code: "wsdw"},
    {name: "SSSD Delivery", img: "mission/disk", code: "sssww"},
    {name: "Super Earth Flag", img: "mission/flag", code: "swsw"},
    {name: "Tectonic Drill", img: "mission/drill", code: "wswsws"},
    {name: "Upload Data", img: "mission/disk", code: "adwww"},
    // Offensive
    {name: "Eagle Airstrike", img: "offensive/eagle/airstrike", code: "wdsd"},
    {name: "Eagle Cluster Bomb", img: "offensive/eagle/cluster", code: "wdssd"},
    {name: "Eagle Napalm Airstrike", img: "offensive/eagle/napalm", code: "wdsw"},
    {name: "Eagle Smoke Strike", img: "offensive/eagle/smoke", code: "wdws"},
    {name: "Eagle Strafing Run", img: "offensive/eagle/strafing", code: "wdd"},
    {name: "Eagle 110mm Rocket Pods", img: "offensive/eagle/110mm", code: "wdwa"},
    {name: "Eagle 500kg Bomb", img: "offensive/eagle/500kg", code: "wdsss"},

    {name: "Orbital Airburst Strike", img: "offensive/orbital/airburst", code: "ddd"},
    {name: "Orbital EMS Strike", img: "offensive/orbital/ems", code: "ddas"},
    {name: "Orbital Gas Strike", img: "offensive/orbital/gas", code: "ddsd"},
    {name: "Orbital Gatling Barrage", img: "offensive/orbital/gatling", code: "dsaww"},
    {name: "Orbital Laser", img: "offensive/orbital/laser", code: "dswds"},
    {name: "Orbital Napalm Barrage", img: "offensive/orbital/napalm", code: "ddsadw"},
    {name: "Orbital Precision Strike", img: "offensive/orbital/precision", code: "ddw"},
    {name: "Orbital Railcannon Strike", img: "offensive/orbital/railcannon", code: "dwssd"},
    {name: "Orbital Smoke Strike", img: "offensive/orbital/smoke", code: "ddsw"},
    {name: "Orbital Walking Barrage", img: "offensive/orbital/walking", code: "dsdsds"},
    {name: "Orbital 120mm HE Barrage", img: "offensive/orbital/120mm", code: "ddsads"},
    {name: "Orbital 380mm HE Barrage", img: "offensive/orbital/380mm", code: "dswwass"},
    // Defensive
    {name: "E/AT-12 Anti-Tank Emplacement", img: "defensive/emplacement/at", code: "swaddd"},
    {name: "E/GL-21 Grenadier Battlement", img: "defensive/emplacement/grenadier", code: "sdsad"},
    {name: "E/MG-101 HMG Emplacement", img: "defensive/emplacement/hmg", code: "swadda"},
    {name: "FX-12 Shield Generator Relay", img: "defensive/emplacement/shield gen", code: "ssadad"},

    {name: "MD-6 Anti-Personnel Minefield", img: "defensive/mine/antipersonel", code: "sawd"},
    {name: "MD-17 Anti-Tank Mines", img: "defensive/mine/at", code: "saww"},
    {name: "MD-8 Gas Mines", img: "defensive/mine/gas", code: "saad"},
    {name: "MD-I4 Incendiary Mines", img: "defensive/mine/incendiary", code: "saas"},

    {name: "A/AC-8 Autocannon Sentry", img: "defensive/turret/autocannon", code: "swdwaw"},
    {name: "A/M-23 EMS Mortar Sentry", img: "defensive/turret/ems mortar", code: "swdsd"},
    {name: "A/FLAM-40 Flame Sentry", img: "defensive/turret/flame", code: "swdsww"},
    {name: "A/G-16 Gatling Sentry", img: "defensive/turret/gatling", code: "swda"},
    {name: "A/LAS-98 Laser Sentry", img: "defensive/turret/laser", code: "swdswd"},
    {name: "A/MG-43 Machine Gun Sentry", img: "defensive/turret/machine gun", code: "swddw"},
    {name: "A/M-12 Mortar Sentry", img: "defensive/turret/mortar", code: "swdds"},
    {name: "A/MLS-4X Rocket Sentry", img: "defensive/turret/rocket", code: "swdda"},
    {name: "A/ARC-3 Tesla Tower", img: "defensive/turret/tesla", code: "swdwad"},
    // Support
    {name: "AX/ARC-3 \"Guard Dog\" K-9", img: "support/backpack/dog/arc", code: "swawda"},
    {name: "AX/AR-23 \"Guard Dog\"", img: "support/backpack/dog/bullet", code: "swawds"},
    {name: "AX/TX-13 \"Guard Dog\" Dog Breath", img: "support/backpack/dog/gas", code: "swawdw"},
    {name: "AX/LAS-5 \"Guard Dog\" Rover", img: "support/backpack/dog/rover", code: "swawdd"},

    {name: "LIFT-860 Hover Pack", img: "support/backpack/lift/hover", code: "swwsad"},
    {name: "LIFT-850 Jump Pack", img: "support/backpack/lift/jump", code: "swwsw"},
    {name: "LIFT-182 Warp Pack", img: "support/backpack/lift/warp", code: "sadsad"},

    {
        name: "SH-20 Ballistic Shield Backpack",
        img: "support/backpack/shield/ballistic",
        code: "sasswa"
    },
    {name: "SH-51 Directional Shield", img: "support/backpack/shield/directional", code: "swadww"},
    {name: "SH-32 Shield Generator Pack", img: "support/backpack/shield/generator", code: "swadad"},

    {name: "B-100 Portable Hellbomb", img: "support/backpack/hellbomb", code: "sdwww"},
    {name: "B-1 Supply Pack", img: "support/backpack/supply", code: "saswws"},

    {name: "EXO-49 Emancipator Exosuit", img: "support/exosuit/emancipator", code: "asdwasw"},
    {name: "EXO-45 Patriot Exosuit", img: "support/exosuit/patriot", code: "asdwass"},

    {name: "M-102 Fast Recon Vehicle", img: "support/vehicle/frv", code: "asdsdsw"},

    {name: "RL-77 Airburst Rocket Launcher", img: "support/weapon/airburst", code: "swwad"},
    {name: "APW-1 Anti-Materiel Rifle", img: "support/weapon/antimateriel", code: "sadws"},
    {name: "ARC-3 Arc Thrower", img: "support/weapon/arc", code: "ssdwaa"},
    {name: "AC-8 Autocannon", img: "support/weapon/autocannon", code: "saswwd"},
    {name: "MLS-4X Commando", img: "support/weapon/commando", code: "sawsd"},
    {name: "GL-52 De-Escalator", img: "support/weapon/deescalator", code: "adwad"},
    {name: "EAT-17 Expendable Anti-Tank", img: "support/weapon/eat", code: "ssawd"},
    {name: "PLAS-45 Epoch", img: "support/weapon/epoch", code: "sawad"},
    {name: "CQC-1 One True Flag", img: "support/weapon/flag", code: "saddw"},
    {name: "FLAM-40 Flamethrower", img: "support/weapon/flame", code: "sawsw"},
    {name: "TX-41 Sterilizer", img: "support/weapon/gas", code: "sawsa"},
    {name: "GL-21 Grenade Launcher", img: "support/weapon/grenade", code: "sawas"},
    {name: "MG-206 Heavy Machine Gun", img: "support/weapon/hmg", code: "sawss"},
    {name: "LAS-98 Laser Cannon", img: "support/weapon/laser", code: "saswa"},
    {name: "M-105 Stalwart", img: "support/weapon/lmg", code: "saswwa"},
    {name: "MG-43 Machine Gun", img: "support/weapon/mmg", code: "saswd"},
    {name: "LAS-99 Quasar Cannon", img: "support/weapon/quasar", code: "sswad"},
    {name: "RS-422 Railgun", img: "support/weapon/railgun", code: "sdswad"},
    {name: "GR-8 Recoilless Rifle", img: "support/weapon/recoilless", code: "sadda"},
    {name: "FAF-14 Spear", img: "support/weapon/spear", code: "sswss"},
    {name: "StA-X3 W.A.S.P. Launcher", img: "support/weapon/wasp", code: "sswsd"}
];

const sfxPrefix = "/assets/sfx/";
const Sfx = {
    arrowFail: sfxPrefix + "arrow fail.ogg",
    arrowComplete: sfxPrefix + "arrow complete.ogg",
    stratagemComplete: sfxPrefix + "stratagem finish.ogg",
    boardComplete: sfxPrefix + "board finish.ogg"

};

const arrowPrefix = "/assets/arrow/";
const Sprites = {
    arrows: {
        w: arrowPrefix + "w.png",
        a: arrowPrefix + "a.png",
        s: arrowPrefix + "s.png",
        d: arrowPrefix + "d.png"
    }
};













