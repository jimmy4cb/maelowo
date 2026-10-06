import { isSupabaseConfigured, supabase } from './supabase-client.js';

const cartButton = document.querySelector('.cart-button');
const cartPanel = document.getElementById('cart-panel');
const closeCartButton = document.querySelector('.close-cart');
const cartCount = document.querySelector('.cart-count');
const cartItems = document.getElementById('cart-items');
const subtotalEl = document.getElementById('subtotal');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const productGrid = document.querySelector('.product-choices');
const catalogMessage = document.getElementById('catalog-message');
const cartStorageKey = 'maelowo-cart';
let catalog = [];

function formatPrice(value) {
  return `KSh ${Number(value).toLocaleString()}`;
}

function loadCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    if (!Array.isArray(savedCart)) return [];
    return savedCart.filter((item) =>
      item &&
      typeof item.name === 'string' &&
      Number.isFinite(item.price) &&
      Number.isInteger(item.qty) &&
      item.qty > 0
    );
  } catch (error) {
    console.error('Unable to load the saved cart.', error);
    return [];
  }
}

const cart = loadCart();

function updateCart() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  cartCount.textContent = totalItems;
  cartItems.replaceChildren();
  cartButton.setAttribute('aria-label', `Cart, ${totalItems} items, ${formatPrice(totalPrice)}`);

  if (!cart.length) {
    const emptyMessage = document.createElement('li');
    emptyMessage.textContent = 'Cart is empty';
    cartItems.appendChild(emptyMessage);
  } else {
    cart.forEach((item, index) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${item.name} x${item.qty}`;

      const price = document.createElement('strong');
      price.textContent = formatPrice(item.qty * item.price);

      const controls = document.createElement('div');
      controls.className = 'cart-item-controls';

      const decrease = document.createElement('button');
      decrease.type = 'button';
      decrease.textContent = '−';
      decrease.setAttribute('aria-label', `Remove one ${item.name}`);
      decrease.addEventListener('click', () => changeQuantity(index, -1));

      const increase = document.createElement('button');
      increase.type = 'button';
      increase.textContent = '+';
      increase.setAttribute('aria-label', `Add one ${item.name}`);
      increase.addEventListener('click', () => changeQuantity(index, 1));

      controls.append(decrease, increase);
      li.append(name, price, controls);
      cartItems.appendChild(li);
    });
  }

  subtotalEl.textContent = formatPrice(totalPrice);
  try {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  } catch (error) {
    console.error('Unable to save the cart.', error);
    cartPanel.classList.add('open');
  }
}

function changeQuantity(index, adjustment) {
  cart[index].qty += adjustment;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  updateCart();
}

function addToCart(product) {
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.qty += 1;
    existing.price = product.price;
    existing.name = product.name;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  }
  updateCart();
  cartPanel.classList.add('open');
}

function renderProducts(products) {
  productGrid.replaceChildren();

  products.forEach((product) => {
    product.price = Number(product.price);
    const card = document.createElement('article');
    card.className = 'product-item product-card';

    if (product.image_url) {
      const image = document.createElement('img');
      image.className = 'catalog-product-image';
      image.src = product.image_url;
      image.alt = product.name;
      image.loading = 'lazy';
      card.appendChild(image);
    }

    const heading = document.createElement('h3');
    heading.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.description || 'Quality MaeLowo Foods';
    const price = document.createElement('div');
    price.className = 'price-row';
    price.textContent = formatPrice(product.price);
    const addButton = document.createElement('button');
    addButton.className = 'buy-btn';
    addButton.type = 'button';
    addButton.textContent = 'Add to cart';
    addButton.addEventListener('click', () => addToCart(product));

    card.append(heading, description, price, addButton);
    productGrid.appendChild(card);
  });
}

if (isSupabaseConfigured) {
  supabase
    .from('products')
    .select('id, name, description, price, image_url')
    .eq('active', true)
    .order('name')
    .then(({ data, error }) => {
      if (error) {
        console.error('Unable to load the product catalog.', error);
        catalogMessage.textContent = 'Products could not be loaded. Please refresh or contact us.';
        catalogMessage.hidden = false;
        return;
      }
      const catalog = data || [];
      renderProducts(catalog);

      let cartChanged = false;
      for (let index = cart.length - 1; index >= 0; index -= 1) {
        const currentProduct = catalog.find((product) => product.id === cart[index].id) ||
          catalog.find((product) => product.name === cart[index].name);
        if (!currentProduct) {
          cart.splice(index, 1);
          cartChanged = true;
          continue;
        }
        cart[index].id = currentProduct.id;
        cart[index].name = currentProduct.name;
        cart[index].price = Number(currentProduct.price);
      }
      if (cartChanged || catalog.length) updateCart();
    })
    .catch((error) => {
      console.error('Unable to connect to the product catalog.', error);
      catalogMessage.textContent = 'Products could not be loaded. Please refresh or contact us.';
      catalogMessage.hidden = false;
    });
} else {
  catalogMessage.textContent = 'Preview catalog shown. Configure Supabase to enable shared products, client accounts, and administration.';
  catalogMessage.hidden = false;
  document.querySelectorAll('.product-card').forEach((card) => {
    const product = {
      id: card.dataset.name,
      name: card.dataset.name,
      price: Number(card.dataset.price)
    };
    card.querySelector('.buy-btn').addEventListener('click', () => addToCart(product));
  });
}

cartButton.addEventListener('click', () => cartPanel.classList.toggle('open'));
closeCartButton.addEventListener('click', () => cartPanel.classList.remove('open'));

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('show');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelector('.checkout-btn').addEventListener('click', () => {
  if (!cart.length) {
    cartPanel.classList.add('open');
    return;
  }
  window.location.href = 'sign.html?next=payment.html';
});

updateCart();
