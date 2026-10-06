import { getProfile, isSupabaseConfigured, showMessage, supabase } from './supabase-client.js';

const message = document.getElementById('admin-message');
const productList = document.getElementById('admin-product-list');
const form = document.getElementById('product-form');
const editId = document.getElementById('product-id');
const cancelEdit = document.getElementById('cancel-edit');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function resetForm() {
  form.reset();
  editId.value = '';
  document.getElementById('product-active').checked = true;
  document.getElementById('product-form-title').textContent = 'Add a product';
  document.getElementById('save-product').textContent = 'Save product';
  cancelEdit.hidden = true;
}

async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, active')
    .order('name');
  if (error) throw error;

  productList.replaceChildren();
  if (!data.length) {
    productList.appendChild(element('p', '', 'No products yet. Add your first catalog item.'));
    return;
  }

  data.forEach((product) => {
    const card = element('article', 'admin-product');
    const details = element('div', 'admin-product-details');
    const name = element('h3', '', product.name);
    const description = element('p', '', `${product.description || 'No description'} · KSh ${Number(product.price).toLocaleString()}`);
    const visibility = element('small', '', product.active ? 'Visible in storefront' : 'Hidden from storefront');
    details.append(name, description, visibility);

    const actions = element('div', 'admin-product-actions');
    const edit = element('button', 'outline-button', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => {
      editId.value = product.id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-description').value = product.description;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-image').value = product.image_url;
      document.getElementById('product-active').checked = product.active;
      document.getElementById('product-form-title').textContent = `Edit ${product.name}`;
      document.getElementById('save-product').textContent = 'Update product';
      cancelEdit.hidden = false;
      document.getElementById('product-name').focus();
    });

    const remove = element('button', 'danger-button', 'Delete');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${product.name} from the catalog?`)) return;
      remove.disabled = true;
      try {
        const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
        if (deleteError) throw deleteError;
        await loadProducts();
        showMessage(message, `${product.name} deleted.`);
      } catch (error) {
        showMessage(message, error.message || 'Could not delete the product.', true);
      } finally {
        remove.disabled = false;
      }
    });

    actions.append(edit, remove);
    card.append(details, actions);
    productList.appendChild(card);
  });
}

async function startAdmin() {
  if (!isSupabaseConfigured) {
    showMessage(message, 'Admin access requires Supabase configuration. See SUPABASE_SETUP.md.', true);
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    window.location.replace('sign.html');
    return;
  }

  const profile = await getProfile(session.user.id);
  if (profile.role !== 'admin') {
    window.location.replace('account.html');
    return;
  }

  document.getElementById('admin-name').textContent = profile.full_name || session.user.email;
  await loadProducts();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = document.getElementById('save-product');
    submitButton.disabled = true;
    showMessage(message, '');
    const product = {
      name: document.getElementById('product-name').value.trim(),
      description: document.getElementById('product-description').value.trim(),
      price: Number(document.getElementById('product-price').value),
      image_url: document.getElementById('product-image').value.trim(),
      active: document.getElementById('product-active').checked
    };

    try {
      const result = editId.value
        ? await supabase.from('products').update(product).eq('id', editId.value)
        : await supabase.from('products').insert(product);
      if (result.error) throw result.error;
      resetForm();
      await loadProducts();
      showMessage(message, 'Product saved. The storefront catalog is updated.');
    } catch (error) {
      showMessage(message, error.message || 'Could not save the product.', true);
    } finally {
      submitButton.disabled = false;
    }
  });

  cancelEdit.addEventListener('click', resetForm);
  document.getElementById('sign-out').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(message, error.message, true);
      return;
    }
    window.location.replace('index.html');
  });
}

startAdmin().catch((error) => {
  console.error('Unable to open the admin portal.', error);
  showMessage(message, error.message || 'Could not load the admin portal.', true);
});
