// Sample API requests to add food items
// You can use this data with Postman or curl commands

const sampleFoodItems = [
  {
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato sauce, mozzarella cheese, and fresh basil",
    "price": 12.99,
    "category": "Pizza",
    "availability": true
  },
  {
    "name": "Chicken Burger", 
    "description": "Grilled chicken breast with lettuce, tomato, and mayo on a brioche bun",
    "price": 9.99,
    "category": "Burgers",
    "availability": true
  },
  {
    "name": "Caesar Salad",
    "description": "Fresh romaine lettuce with parmesan cheese, croutons, and caesar dressing", 
    "price": 8.99,
    "category": "Salads",
    "availability": true
  },
  {
    "name": "Spaghetti Carbonara",
    "description": "Creamy pasta with eggs, parmesan cheese, pancetta, and black pepper",
    "price": 14.99,
    "category": "Pasta", 
    "availability": true
  },
  {
    "name": "Chocolate Cake",
    "description": "Rich chocolate layer cake with chocolate frosting",
    "price": 6.99,
    "category": "Desserts",
    "availability": true
  }
];

/*
To add these items via API:

1. First, register/login as a restaurant admin to get JWT token
2. Then use POST requests to create each food item:

POST http://localhost:5002/api/food-items/create
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_JWT_TOKEN

Body: (one of the objects from sampleFoodItems array above)

Example curl command:
curl -X POST http://localhost:5002/api/food-items/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato sauce, mozzarella cheese, and fresh basil",
    "price": 12.99,
    "category": "Pizza",
    "availability": true
  }'
*/

export default sampleFoodItems;