"use client";

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useSyncExternalStore,
  ReactNode,
} from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "foodstream-cart";
// Fired in this tab when the cart is written ("storage" only reaches the other tabs).
const CART_CHANGE_EVENT = "foodstream-cart-change";
const EMPTY_CART: CartItem[] = [];

// The cart lives in localStorage: components read it through useSyncExternalStore.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY_CART;

function getCartSnapshot(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_CART;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedItems = raw ? (JSON.parse(raw) as CartItem[]) : EMPTY_CART;
    } catch {
      cachedItems = EMPTY_CART;
    }
  }
  return cachedItems;
}

function getServerCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function subscribeCart(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CART_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CART_CHANGE_EVENT, onChange);
  };
}

function setItems(update: (prev: CartItem[]) => CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(update(getCartSnapshot())));
  } catch {
    // storage full or blocked: the cart is not kept
  }
  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);

      if (existing) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }

      return [...prev, { ...item, quantity: 1 }];
    });

    setIsOpen(true);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const decreaseQuantity = useCallback((id: string) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => setItems(() => []), []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const contextValue = useMemo(
    () => ({
      items,
      isOpen,
      openCart,
      closeCart,
      addToCart,
      removeFromCart,
      decreaseQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }),
    [
      items,
      isOpen,
      openCart,
      closeCart,
      addToCart,
      removeFromCart,
      decreaseQuantity,
      clearCart,
      totalItems,
      totalPrice,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}
