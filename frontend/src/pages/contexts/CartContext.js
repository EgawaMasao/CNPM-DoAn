import React, { createContext, useState } from "react";

// Create the CartContext
export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Function to add item to cart with restaurant info
  const addToCart = (food, restaurantId = null) => {
    const foodWithRestaurant = {
      ...food,
      restaurantId: restaurantId || food.restaurantId
    };
    setCartItems((prevItems) => [...prevItems, foodWithRestaurant]);
  };

  // Function to remove item from cart
  const removeFromCart = (foodId) => {
    setCartItems((prevItems) => prevItems.filter(item => item._id !== foodId));
  };

  // Function to clear cart
  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
