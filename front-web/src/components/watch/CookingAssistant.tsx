"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Users,
  ChefHat,
  Info,
} from "lucide-react";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type Ingredient = {
  name: string;
  qty: string;
  sub?: string;
};

type Cutting = {
  name: string;
  desc: string;
};

type Recipe = {
  title: string;
  ingredients: Ingredient[];
  cuttings: Cutting[];
  cookingInstructions: string[];
  timerDuration: number; // in seconds
  timerLabel: string;
  platingInstructions: string[];
  utensils?: string[];
  prepTimeMins?: number;
  restTimeMins?: number;
};

const RECIPES: Record<string, Recipe> = {
  ramen: {
    title: "Ramen Tonkotsu Traditionnel",
    ingredients: [
      { name: "Nouilles de Ramen fraîches", qty: "200g" },
      { name: "Porc Chashu en tranches", qty: "4 tranches", sub: "Tofu ferme grillé ou Tranches de poulet rôti" },
      { name: "Œuf Ajitsuke (mollet mariné)", qty: "1 œuf", sub: "Œuf mollet classique sans marinade" },
      { name: "Bouillon Tonkotsu (porc/volaille)", qty: "500ml", sub: "Bouillon de miso ou de légumes concentré" },
      { name: "Cébette (oignon vert)", qty: "2 tiges" },
      { name: "Feuille d'algue Nori", qty: "1 feuille" },
    ],
    cuttings: [
      { name: "Ciselage des cébettes", desc: "Émincer très finement en biais (style biseau) pour libérer les arômes et servir en finition." },
      { name: "Tranchage du Porc", desc: "Couper des tranches régulières d'environ 1 cm d'épaisseur avant de les réchauffer légèrement." },
    ],
    cookingInstructions: [
      "Faire chauffer le bouillon Tonkotsu à frémissement dans une casserole.",
      "Cuire les nouilles de Ramen dans de l'eau bouillante non salée pendant 2 minutes maximum.",
      "Égoutter soigneusement les nouilles pour ne pas diluer le bouillon.",
      "Placer le bouillon bien chaud au fond de chaque bol de service."
    ],
    timerDuration: 120, // 2 minutes
    timerLabel: "Cuisson des nouilles",
    platingInstructions: [
      "Déposer délicatement le nid de nouilles égoutté au centre du bouillon chaud.",
      "Disposer le porc chashu chaud sur un côté du bol.",
      "Couper l'œuf ajitsuke en deux dans la longueur et placer les moitiés au centre.",
      "Parsemer généreusement de cébettes ciselées et insérer un carré de nori sur le bord du bol."
    ],
  },
  macaron: {
    title: "Macarons Framboise & Chocolat",
    ingredients: [
      { name: "Poudre d'amandes extra-fine", qty: "110g", sub: "Poudre de noisettes tamisée" },
      { name: "Sucre glace", qty: "110g" },
      { name: "Blancs d'œufs (température ambiante)", qty: "80g" },
      { name: "Sucre en poudre", qty: "90g" },
      { name: "Colorant alimentaire en gel", qty: "Quelques gouttes" },
    ],
    cuttings: [
      { name: "Tamiser le tant-pour-tant", desc: "Passer la poudre d'amandes et le sucre glace au tamis fin pour obtenir des coques lisses." },
    ],
    cookingInstructions: [
      "Monter les blancs en neige ferme en incorporant le sucre en poudre en trois fois.",
      "Ajouter le colorant puis réaliser le macaronage (mélanger délicatement le tant-pour-tant en rabattant la pâte).",
      "Pocher les macarons sur une plaque munie de papier cuisson.",
      "Laisser croûter (sécher) à l'air libre pendant 30 minutes avant d'enfourner."
    ],
    timerDuration: 720, // 12 minutes
    timerLabel: "Cuisson au four (150°C)",
    platingInstructions: [
      "Laisser refroidir complètement les coques avant de les décoller de la plaque.",
      "Sélectionner des coques de tailles identiques par paires.",
      "Garnir une coque avec de la confiture de framboise ou de la ganache chocolat à la poche à douille.",
      "Refermer délicatement avec la seconde coque en tournant légèrement."
    ],
  },
  curry: {
    title: "Curry Vert Thaïlandais",
    ingredients: [
      { name: "Pâte de curry vert thaï", qty: "2 cuillères à soupe", sub: "Pâte de curry jaune ou rouge (plus doux)" },
      { name: "Lait de coco", qty: "400ml" },
      { name: "Blanc de poulet ou Tofu ferme", qty: "300g", sub: "Crevettes décortiquées ou Aubergines supplémentaires" },
      { name: "Aubergines thaïlandaises", qty: "4 petites", sub: "Courgettes coupées en quartiers" },
      { name: "Feuilles de basilic thaï", qty: "1 poignée" },
      { name: "Sauce poisson (Nuoc mam)", qty: "1 cuillère à soupe", sub: "Sauce soja claire" },
    ],
    cuttings: [
      { name: "Découpe des protéines", desc: "Couper le poulet ou le tofu en cubes bouchées uniformes de 2 cm pour une cuisson rapide." },
      { name: "Quartiers d'aubergine", desc: "Couper les aubergines thaï en quatre parts égales." },
    ],
    cookingInstructions: [
      "Faire revenir la pâte de curry dans une sauteuse chaude avec un filet d'huile.",
      "Verser le lait de coco progressivement en mélangeant bien.",
      "Ajouter les protéines et les aubergines, porter à frémissement.",
      "Laisser mijoter jusqu'à ce que les aubergines soient tendres et la sauce onctueuse."
    ],
    timerDuration: 900, // 15 minutes
    timerLabel: "Mijotage du curry",
    platingInstructions: [
      "Dresser le curry bien chaud dans des bols creux.",
      "Parsemer de feuilles de basilic thaï frais juste avant de servir.",
      "Accompagner d'un bol de riz jasmin cuit à la vapeur."
    ],
  },
  default: {
    title: "Recette du Chef",
    ingredients: [
      { name: "Ingrédients principaux", qty: "Selon recette" },
      { name: "Garnitures et herbes fraîches", qty: "1 botte" },
      { name: "Assaisonnement (sel, poivre, épices)", qty: "Au goût", sub: "Épices douces ou pimentées" },
      { name: "Huile de cuisson ou beurre", qty: "2 cuillères à soupe" },
    ],
    cuttings: [
      { name: "Découpe uniforme", desc: "Tailler tous les légumes et protéines de tailles égales pour assurer une cuisson homogène." },
    ],
    cookingInstructions: [
      "Préparer et organiser le plan de travail (mise en place).",
      "Saisir les ingrédients principaux à feu vif.",
      "Baisser le feu, assaisonner et laisser cuire doucement en remuant régulièrement."
    ],
    timerDuration: 600, // 10 minutes
    timerLabel: "Cuisson principale",
    platingInstructions: [
      "Disposer les éléments harmonieusement dans l'assiette.",
      "Ajouter les herbes et les épices de finition.",
      "Nettoyer les bords de l'assiette avant d'envoyer."
    ],
  },
};

type Props = Readonly<{
  dishName?: string;
  roomTitle?: string;
  roomParticipants?: { username: string }[];
  recipeData?: {
    ingredients?: { name: string; qty: string }[];
    prepSteps?: string[];
    cookingTimer?: number;
    platingSteps?: string[];
    utensils?: string[];
    prepTimeMins?: number;
    restTimeMins?: number;
  } | null;
}>;

type ParticipantState = {
  username: string;
  activeStep: number;
  prepProgress: number; // Checked count
  timerActive: boolean;
};

export default function CookingAssistant({ dishName, roomTitle, roomParticipants, recipeData }: Props) {
  // Detect recipe based on props
  const recipe = useMemo(() => {
    if (recipeData && (recipeData.ingredients?.length || recipeData.cookingTimer || recipeData.platingSteps?.length)) {
      return {
        title: roomTitle || "Recette personnalisée",
        ingredients: (recipeData.ingredients || []).map((ing) => ({
          name: ing.name,
          qty: ing.qty,
          sub: "",
        })),
        cuttings: (recipeData.prepSteps || []).map((step) => {
          if (step.includes(":")) {
            const parts = step.split(":");
            return {
              name: parts[0].trim(),
              desc: parts[1].trim(),
            };
          }
          return {
            name: "Préparation",
            desc: step,
          };
        }),
        cookingInstructions: [
          "Suivre les indications du chef en direct.",
          "Lancer le minuteur de cuisson ci-dessous lorsque le chef le demande."
        ],
        timerDuration: recipeData.cookingTimer || 0,
        timerLabel: "Temps de cuisson saisi par le chef",
        platingInstructions: recipeData.platingSteps || [],
        utensils: recipeData.utensils || [],
        prepTimeMins: recipeData.prepTimeMins || 0,
        restTimeMins: recipeData.restTimeMins || 0,
      };
    }

    const text = `${dishName || ""} ${roomTitle || ""}`.toLowerCase();
    if (text.includes("ramen")) return RECIPES.ramen;
    if (text.includes("macaron")) return RECIPES.macaron;
    if (text.includes("curry")) return RECIPES.curry;
    return null;
  }, [dishName, roomTitle, recipeData]);

  const [activeStep, setActiveStep] = useState(0); // 0 = Prep, 1 = Cooking, 2 = Plating
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showSubFor, setShowSubFor] = useState<string | null>(null);

  // Timer State
  const [timerLeft, setTimerLeft] = useState(recipe?.timerDuration ?? 0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Reset timer on recipe change
  useEffect(() => {
    if (recipe) {
      setTimerLeft(recipe.timerDuration);
    }
    setTimerRunning(false);
  }, [recipe]);

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;

    const interval = setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  // Format time (mm:ss)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Checklist handler
  const toggleIngredient = (name: string) => {
    const next = new Set(checkedIngredients);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setCheckedIngredients(next);
  };

  // Initialize simulated participants
  const defaultParticipants = useMemo(() => {
    const list = roomParticipants?.map((p) => p.username) || [];
    if (list.length === 0) {
      return ["Aiko Tanaka", "Chef Simon", "Camille Dupont", "Luis Ortega"];
    }
    return list;
  }, [roomParticipants]);

  const [peers, setPeers] = useState<ParticipantState[]>([]);

  useEffect(() => {
    setPeers(
      defaultParticipants.map((name) => ({
        username: name,
        activeStep: 0,
        prepProgress: Math.floor(Math.random() * 3), // random starting checked items
        timerActive: false,
      }))
    );
  }, [defaultParticipants]);

  // Simulate peer progress
  useEffect(() => {
    if (!recipe || !recipe.ingredients?.length) return;

    const interval = setInterval(() => {
      setPeers((prevPeers) => {
        if (prevPeers.length === 0) return prevPeers;

        // Choose one random peer to update
        const idx = Math.floor(Math.random() * prevPeers.length);
        const updated = [...prevPeers];
        const peer = { ...updated[idx] };

        if (peer.activeStep === 0) {
          // Increase prep checked count or move to preparation
          if (peer.prepProgress < recipe.ingredients.length) {
            peer.prepProgress += 1;
          } else {
            peer.activeStep = 1;
          }
        } else if (peer.activeStep === 1) {
          // Move to cooking
          peer.activeStep = 2;
          peer.timerActive = true;
        } else if (peer.activeStep === 2) {
          // Finish cooking or move to plating
          if (Math.random() > 0.4) {
            peer.activeStep = 3;
            peer.timerActive = false;
          }
        } else {
          // Plating complete (randomize reset or keep)
          if (Math.random() > 0.8) {
            peer.activeStep = 0;
            peer.prepProgress = 0;
          }
        }

        updated[idx] = peer;
        return updated;
      });
    }, 12000); // Update a peer every 12 seconds

    return () => clearInterval(interval);
  }, [recipe]);

  const prepProgressPercent = useMemo(() => {
    const total = recipe?.ingredients?.length ?? 0;
    if (total === 0) return 0;
    return Math.round((checkedIngredients.size / total) * 100);
  }, [checkedIngredients.size, recipe?.ingredients?.length]);

  if (!recipe) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-6 bg-white/40 dark:bg-black/10">
        <ChefHat className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Cuisine Coop vide
        </h3>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 max-w-[240px] leading-relaxed">
          Le chef n'a pas configuré d'étapes de recette ni de minuteur pour ce live.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/40 dark:bg-black/10">
      {/* Steps Header Progress bar */}
      <div className="border-b border-black/8 px-4 py-4 dark:border-white/10 bg-white/20 dark:bg-black/30">
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-3">
          <span>{recipe.title}</span>
          <span className="text-orange-600 dark:text-orange-400">Étape {activeStep + 1}/4</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(["Ingrédients", "Préparation", "Cuisson", "Dressage"] as const).map((stepName, index) => {
            const active = activeStep === index;
            const completed = activeStep > index;

            return (
              <button
                key={stepName}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`relative flex flex-col items-center rounded-xl py-2 transition ${
                  active
                    ? "bg-white/90 text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
                    : completed
                    ? "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                    : "text-gray-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex flex-col items-center gap-0.5 text-[10px] sm:text-xs font-semibold leading-tight text-center">
                  {completed ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : null}
                  <span>{stepName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main step content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {activeStep === 0 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Ingredients Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Ingrédients requis
                </h3>

                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  {checkedIngredients.size}/{recipe.ingredients.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-black/[0.06] rounded-full overflow-hidden dark:bg-white/10">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{ width: `${prepProgressPercent}%`, background: ORANGE_GRADIENT_CSS }}
                />
              </div>

              <div className="space-y-2 mt-3">
                {recipe.ingredients.map((item, idx) => {
                  const isChecked = checkedIngredients.has(item.name);

                  return (
                    <div
                      key={`${item.name}-${idx}`}
                      className={`flex flex-col gap-2 rounded-2xl border p-3 transition ${
                        isChecked
                          ? "border-orange-500/20 bg-orange-500/5 dark:border-orange-500/10 dark:bg-orange-500/[0.02]"
                          : "border-black/5 bg-white/50 dark:border-white/5 dark:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleIngredient(item.name)}
                            className="sr-only"
                          />
                          <div
                            className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition ${
                              isChecked
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-gray-300 dark:border-gray-600 bg-transparent"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-sm font-semibold transition ${
                                isChecked
                                  ? "text-gray-400 line-through dark:text-gray-500"
                                  : "text-gray-900 dark:text-gray-100"
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({item.qty})
                            </span>
                          </div>
                        </label>

                        {item.sub && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowSubFor(showSubFor === item.name ? null : item.name)
                            }
                            aria-label="Voir les substitutions"
                            className={`rounded-lg p-1 transition ${
                              showSubFor === item.name
                                ? "text-orange-500 bg-orange-500/10"
                                : "text-gray-400 hover:text-gray-500"
                            }`}
                          >
                            <HelpCircle className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>

                      {showSubFor === item.name && item.sub && (
                        <div className="mt-1 flex items-start gap-2 rounded-xl bg-orange-500/10 p-2.5 text-xs text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                          <Info className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>
                            <strong className="font-bold">Substitutions possibles :</strong> {item.sub}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Utensils checklist/info */}
            {recipe.utensils && recipe.utensils.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Matériel & Ustensiles nécessaires
                </h3>

                <div className="flex flex-wrap gap-2">
                  {recipe.utensils.map((ut, idx) => (
                    <div
                      key={`${ut}-${idx}`}
                      className="rounded-xl border border-black/5 bg-white/50 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-200"
                    >
                      {ut}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Prep/Rest Time Badges */}
            {((recipe.prepTimeMins && recipe.prepTimeMins > 0) || (recipe.restTimeMins && recipe.restTimeMins > 0)) && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {recipe.prepTimeMins && recipe.prepTimeMins > 0 ? (
                  <div className="rounded-2xl border border-black/5 bg-white/60 p-3 text-center dark:border-white/5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      Préparation
                    </span>
                    <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                      {recipe.prepTimeMins} min
                    </span>
                  </div>
                ) : null}

                {recipe.restTimeMins && recipe.restTimeMins > 0 ? (
                  <div className="rounded-2xl border border-black/5 bg-white/60 p-3 text-center dark:border-white/5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      Repos
                    </span>
                    <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                      {recipe.restTimeMins} min
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Cuttings / Techniques */}
            {recipe.cuttings.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Techniques & Découpe
                </h3>

                <div className="space-y-2">
                  {recipe.cuttings.map((cut, idx) => (
                    <div
                      key={`${cut.name}-${idx}`}
                      className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/5 dark:bg-white/[0.02]"
                    >
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {cut.name}
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {cut.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <ChefHat className="mx-auto h-10 w-10 text-orange-500 mb-2 animate-bounce" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Mise en place & Préparation
                </h4>
                <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  Lavez, épluchez et découpez vos ingrédients selon les consignes du chef en direct avant de passer à la cuisson.
                </p>
              </div>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Custom Timer Card */}
            <div className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm dark:border-white/5 dark:bg-white/[0.02] flex flex-col items-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1">
                Minuteur de Cuisson
              </span>
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">
                {recipe.timerLabel}
              </h4>

              {/* Visual Circular Timer */}
              <div className="relative flex h-36 w-36 items-center justify-center mb-5">
                <svg className="absolute inset-0 h-full w-full -rotate-95">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    className="stroke-black/[0.06] dark:stroke-white/10"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    className="stroke-orange-500 transition-all duration-1000"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 64}
                    strokeDashoffset={
                      2 * Math.PI * 64 * (1 - timerLeft / recipe.timerDuration)
                    }
                    strokeLinecap="round"
                  />
                </svg>

                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {formatTime(timerLeft)}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md hover:bg-orange-600 transition active:scale-95"
                >
                  {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerLeft(recipe.timerDuration);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/8 bg-white/70 text-gray-700 hover:bg-white transition active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Cooking Instructions list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Instructions de cuisson
              </h3>

              <ol className="space-y-2">
                {recipe.cookingInstructions.map((stepText, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 rounded-2xl border border-black/5 bg-white/50 p-4 text-sm text-gray-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-300"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-black text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                      {idx + 1}
                    </span>
                    <span className="leading-6">{stepText}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Conseils de Dressage
            </h3>

            <ol className="space-y-2">
              {recipe.platingInstructions.map((stepText, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 rounded-2xl border border-black/5 bg-white/50 p-4 text-sm text-gray-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-300"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-black text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                    {idx + 1}
                  </span>
                  <span className="leading-6">{stepText}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Peer Progress Board (Collaborative) */}
      <div className="border-t border-black/8 bg-white/60 p-4 dark:border-white/10 dark:bg-black/40">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
          <Users className="h-4 w-4" />
          Progression de la Room
        </h3>

        <div className="space-y-2">
          {/* User status */}
          <div className="flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="font-bold text-gray-900 dark:text-white truncate">Vous</span>
            </div>

            <div className="text-gray-500 dark:text-gray-400 font-semibold shrink-0">
              {activeStep === 0
                ? `Ingrédients (${checkedIngredients.size}/${recipe.ingredients.length})`
                : activeStep === 1
                ? "Préparation 🔪"
                : activeStep === 2
                ? "Cuisson ⏳"
                : "Dressage 🍽️"}
            </div>
          </div>

          {/* Peers status */}
          {peers.map((peer, idx) => (
            <div key={`${peer.username}-${idx}`} className="flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                <span className="text-gray-700 dark:text-gray-300 truncate">{peer.username}</span>
              </div>

              <div className="text-gray-500 dark:text-gray-400 shrink-0">
                {peer.activeStep === 0
                  ? `Ingrédients (${peer.prepProgress}/${recipe.ingredients.length})`
                  : peer.activeStep === 1
                  ? "Préparation 🔪"
                  : peer.activeStep === 2
                  ? "Cuisson ⏳"
                  : "Dressage 🍽️"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav Controls at bottom */}
      <div className="border-t border-black/8 p-3 flex justify-between bg-white/20 dark:bg-black/20">
        <button
          type="button"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((prev) => prev - 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/8 bg-white/70 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </button>

        <button
          type="button"
          disabled={activeStep === 3}
          onClick={() => setActiveStep((prev) => prev + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Suivant
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
