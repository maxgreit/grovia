<?php
/**
 * Theme functions and definitions.
 *
 * @package HelloElementorChild
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'HELLO_ELEMENTOR_CHILD_VERSION', '2.0.0' );

/**
 * Load child theme scripts & styles.
 */
function hello_elementor_child_scripts_styles() {
	wp_enqueue_style(
		'hello-elementor-child-style',
		get_stylesheet_directory_uri() . '/style.css',
		[
			'hello-elementor-theme-style',
		],
		HELLO_ELEMENTOR_CHILD_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'hello_elementor_child_scripts_styles', 20 );


/* =========================================================
   GROVIA - Variation UI as clickable pills
   + size fields only for "incl tenue"
========================================================= */

/* 1) Force term order in variation dropdown */
add_filter('woocommerce_dropdown_variation_attribute_options_args', function($args){
	if (empty($args['attribute']) || empty($args['product'])) {
		return $args;
	}

	$attribute = $args['attribute'];

	if (taxonomy_exists($attribute)) {
		$args['orderby'] = 'term_order';
		$args['order']   = 'ASC';
	}

	return $args;
}, 10, 1);


/* 3) Output size selects */
add_action('woocommerce_before_add_to_cart_button', function () {
	if (!is_product()) return;

	global $product;
	if (!$product || $product->get_type() !== 'variable') return;

	// Maten conform de Jako-teamshop. Voetbalscholen (Kolping, Schagen en
	// toekomstige) krijgen de volledige lijst; MiniMove (categorie 'minimove')
	// alleen de kindermaten 98 t/m 152.
	$is_minimove = has_term('minimove', 'product_cat', $product->get_id());
	$shirt_sizes = $is_minimove
		? ['98','104','110','116','128','140','152']
		: ['98','104','110','116','128','140','152','164','S','M','L','XL','XXL'];
	$broek_sizes = $shirt_sizes;
	$sok_sizes   = ['27–30','31–34','35–38','39–42','43–46'];

	echo '<div class="ka-tenue-sizes" aria-hidden="true">';
	echo '<div class="ka-tenue-title">Kies je maten</div>';
	echo '<div class="ka-tenue-grid">';

	echo '<div class="ka-tenue-field">
			<label>Maat shirt</label>
			<select name="tenue_maat_shirt">
				<option value="">Kies maat</option>';
	foreach ($shirt_sizes as $s) {
		echo '<option value="' . esc_attr($s) . '">' . esc_html($s) . '</option>';
	}
	echo '	</select>
		  </div>';

	echo '<div class="ka-tenue-field">
			<label>Maat broekje</label>
			<select name="tenue_maat_broekje">
				<option value="">Kies maat</option>';
	foreach ($broek_sizes as $s) {
		echo '<option value="' . esc_attr($s) . '">' . esc_html($s) . '</option>';
	}
	echo '	</select>
		  </div>';

	echo '<div class="ka-tenue-field ka-tenue-field--full">
			<label>Maat sokken</label>
			<select name="tenue_maat_sokken">
				<option value="">Kies maat</option>';
	foreach ($sok_sizes as $s) {
		echo '<option value="' . esc_attr($s) . '">' . esc_html($s) . '</option>';
	}
	echo '	</select>
		  </div>';

	echo '</div></div>';
});


/* 5) Save size fields to cart + show in cart/checkout + save to order */
add_filter('woocommerce_add_cart_item_data', function ($cart_item_data, $product_id, $variation_id) {
	$keys = ['tenue_maat_shirt','tenue_maat_broekje','tenue_maat_sokken'];

	foreach ($keys as $key) {
		if (!empty($_POST[$key])) {
			$cart_item_data[$key] = sanitize_text_field(wp_unslash($_POST[$key]));
		}
	}

	return $cart_item_data;
}, 10, 3);

add_filter('woocommerce_get_item_data', function ($item_data, $cart_item) {
	$map = [
		'tenue_maat_shirt'   => 'Shirtmaat',
		'tenue_maat_broekje' => 'Broekmaat',
		'tenue_maat_sokken'  => 'Sokkenmaat',
	];

	foreach ($map as $k => $label) {
		if (!empty($cart_item[$k])) {
			$item_data[] = [
				'name'  => $label,
				'value' => $cart_item[$k]
			];
		}
	}

	return $item_data;
}, 10, 2);

add_action('woocommerce_checkout_create_order_line_item', function ($item, $cart_item_key, $values) {
	$map = [
		'tenue_maat_shirt'   => 'Shirtmaat',
		'tenue_maat_broekje' => 'Broekmaat',
		'tenue_maat_sokken'  => 'Sokkenmaat',
	];

	foreach ($map as $k => $label) {
		if (!empty($values[$k])) {
			$item->add_meta_data($label, $values[$k], true);
		}
	}
}, 10, 3);


/* 6) Front-end UI: clickable pills + show/hide size box */
add_action('wp_footer', function () {
	if (!is_product()) return;
	?>
	<style>
	.ka-groep-kinderen{ display:none; flex-direction:column; gap:8px; margin-top:8px; padding-left:12px; }
	.ka-groep.is-open .ka-groep-kinderen{ display:flex; }
	.ka-groep-kop{ display:flex; align-items:center; justify-content:space-between; width:100%; }
	.ka-groep-pijl{ display:inline-block; transition:transform .15s ease; }
	.ka-groep.is-open .ka-groep-pijl{ transform:rotate(90deg); }
	</style>
	<script>
	(function(){
		const form = document.querySelector('form.variations_form');
		if(!form) return;

		const sizesWrap = form.querySelector('.ka-tenue-sizes');
		const select = form.querySelector('select[name^="attribute_"]');
		if(!select) return;

		let variations = [];
		try {
			variations = JSON.parse(form.getAttribute('data-product_variations') || '[]');
		} catch(e){
			variations = [];
		}

		const priceMap = {};
		variations.forEach(v => {
			const attrs = v.attributes || {};
			const val = Object.values(attrs)[0];
			if(val) priceMap[val] = v.display_price;
		});

		const desiredOrder = [
			'cyclus-1',
			'cyclus-2',
			'cyclus-3',
			'cyclus-4',
			'seizoenkaart-inclusief-tenue',
			'seizoenkaart-zonder-tenue'
		];

		const rawOptions = Array.from(select.options)
			.filter(o => o.value && o.value !== '')
			.map(o => ({ value: o.value, label: o.textContent.trim() }));

		const map = {};
		rawOptions.forEach(o => map[o.value] = o);

		const options = [];
		desiredOrder.forEach(v => {
			if(map[v]) options.push(map[v]);
		});

		rawOptions.forEach(o => {
			if(!desiredOrder.includes(o.value)) options.push(o);
		});

		const pills = document.createElement('div');
		pills.className = 'ka-variation-pills';
		pills.setAttribute('data-for', select.name);

		function maakPil(opt){
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'ka-pill';
			btn.setAttribute('data-value', opt.value);

			const p = priceMap[opt.value];
			const priceTxt = (typeof p === 'number'
				? new Intl.NumberFormat('nl-NL', { style:'currency', currency:'EUR' }).format(p)
				: '');

			btn.innerHTML = '<span class="ka-pill-label">' + opt.label + '</span>' + (priceTxt ? '<span class="ka-pill-price">(' + priceTxt + ')</span>' : '');

			btn.addEventListener('click', function(){
				select.value = opt.value;
				select.dispatchEvent(new Event('change', { bubbles:true }));
				jQuery(select).trigger('change');
			});

			return btn;
		}

		const gegroepeerd = new Set();

		['1','2','3','4'].forEach(nr => {
			const basisWaarde = 'cyclus-' + nr;
			const opties = options.filter(o => o.value === basisWaarde || o.value.indexOf('cyclus-' + nr + '-strippenkaart-') === 0);
			if(!opties || !opties.length) return;

			opties.forEach(o => gegroepeerd.add(o.value));

			if(opties.length === 1){
				pills.appendChild(maakPil(opties[0]));
				return;
			}

			const basisOptie = opties.find(o => o.value === basisWaarde);
			const groepLabel = basisOptie ? basisOptie.label : ('Cyclus ' + nr);

			const groep = document.createElement('div');
			groep.className = 'ka-groep';

			const kop = document.createElement('button');
			kop.type = 'button';
			kop.className = 'ka-pill ka-groep-kop';
			kop.innerHTML = '<span class="ka-pill-label">' + groepLabel + '</span><span class="ka-groep-pijl">&rsaquo;</span>';
			kop.addEventListener('click', function(){
				groep.classList.toggle('is-open');
			});

			const kinderen = document.createElement('div');
			kinderen.className = 'ka-groep-kinderen';
			opties.forEach(o => kinderen.appendChild(maakPil(o)));

			groep.appendChild(kop);
			groep.appendChild(kinderen);
			pills.appendChild(groep);
		});

		options.forEach(opt => {
			if(gegroepeerd.has(opt.value)) return;
			pills.appendChild(maakPil(opt));
		});

		const td = select.closest('td');
		if(td){
			td.insertBefore(pills, select);
			select.classList.add('ka-hidden-select');
		}

		function updateActive(){
			const val = select.value || '';
			pills.querySelectorAll('.ka-pill').forEach(b => {
				b.classList.toggle('is-active', b.getAttribute('data-value') === val);
			});
			pills.querySelectorAll('.ka-groep').forEach(g => {
				if(g.querySelector('.ka-pill[data-value="' + val + '"]')){
					g.classList.add('is-open');
				}
			});
		}

		function needsSizesFromValue(v){
			const val = String(v || '').toLowerCase();
			return (val.includes('tenue') && !val.includes('zonder')) || val.includes('strippenkaart');
		}

		function toggleSizes(show){
			if(!sizesWrap) return;
			sizesWrap.style.display = show ? 'block' : 'none';
			sizesWrap.setAttribute('aria-hidden', show ? 'false' : 'true');

			if(!show){
				sizesWrap.querySelectorAll('select').forEach(s => s.value = '');
			}
		}

		jQuery(document).on('found_variation', function(e, variation){
			updateActive();

			let needs = false;
			if(variation && variation.attributes){
				Object.values(variation.attributes).forEach(v => {
					if(needsSizesFromValue(v)) needs = true;
				});
			} else {
				needs = needsSizesFromValue(select.value);
			}

			toggleSizes(needs);
		});

		jQuery(document).on('reset_data', function(){
			updateActive();
			toggleSizes(false);
		});

		select.addEventListener('change', function(){
			updateActive();
			toggleSizes(needsSizesFromValue(select.value));
		});

		updateActive();
		toggleSizes(needsSizesFromValue(select.value));
	})();
	</script>
	<?php
}, 100);


/* Direct naar afrekenen na add to cart */
add_filter('woocommerce_add_to_cart_redirect', function($url){
	return wc_get_checkout_url();
});

/* WooCommerce meldingen uitzetten */
add_filter('wc_add_to_cart_message_html', '__return_empty_string');
add_filter('woocommerce_add_to_cart_message', '__return_empty_string');
add_filter('woocommerce_cart_item_removed_notice_type', '__return_empty_string');

/* Zorg dat notices op checkout niet renderen */
add_action('wp', function(){
	if (function_exists('is_checkout') && is_checkout()) {
		remove_action('woocommerce_before_checkout_form', 'woocommerce_output_all_notices', 10);
	}
});

/* =========================================================
   GROVIA - Formulier producten
   Productpagina: alleen Vereniging + Team
   Checkout: apart blok voor kind/deelnemer
   Telefoon verplicht
========================================================= */

/* Helper: check of product in categorie 'formulier' zit */
function grovia_is_formulier_product($product_id) {
	return has_term('formulier', 'product_cat', $product_id);
}


/* Productvelden tonen op productpagina */
add_action('woocommerce_before_add_to_cart_button', function () {
	if (!is_product()) return;

	global $product;
	if (!$product) return;

	$product_id = $product->get_id();
	if (!grovia_is_formulier_product($product_id)) return;

	echo '<div class="grovia-formulier-velden">';
	echo '<div class="grovia-formulier-title">Aanvullende informatie</div>';

	echo '<p class="form-row form-row-first">
			<label for="grovia_vereniging">Vereniging <span class="required">*</span></label>
			<input type="text" name="grovia_vereniging" id="grovia_vereniging" placeholder="Bijv. SV Grovia" required />
		  </p>';

	echo '<p class="form-row form-row-last">
			<label for="grovia_team">Team <span class="required">*</span></label>
			<input type="text" name="grovia_team" id="grovia_team" placeholder="Bijv. JO12-2" required />
		  </p>';

	echo '</div>';
}, 9);


/* Validatie productvelden */
add_filter('woocommerce_add_to_cart_validation', function ($passed, $product_id, $qty, $variation_id = 0, $variations = []) {

	if (!grovia_is_formulier_product($product_id)) {
		return $passed;
	}

	$club = isset($_POST['grovia_vereniging']) ? trim(wp_unslash($_POST['grovia_vereniging'])) : '';
	$team = isset($_POST['grovia_team']) ? trim(wp_unslash($_POST['grovia_team'])) : '';

	if ($club === '') {
		wc_add_notice('Vul de vereniging in.', 'error');
		return false;
	}

	if ($team === '') {
		wc_add_notice('Vul het team in.', 'error');
		return false;
	}

	return $passed;
}, 20, 6);


/* Opslaan productvelden in cart */
add_filter('woocommerce_add_cart_item_data', function ($cart_item_data, $product_id, $variation_id) {

	if (!grovia_is_formulier_product($product_id)) {
		return $cart_item_data;
	}

	$keys = ['grovia_vereniging','grovia_team'];
	$has_any = false;

	foreach ($keys as $key) {
		if (!empty($_POST[$key])) {
			$cart_item_data[$key] = sanitize_text_field(wp_unslash($_POST[$key]));
			$has_any = true;
		}
	}

	if ($has_any) {
		$cart_item_data['grovia_unique_key'] = wp_generate_uuid4();
	}

	return $cart_item_data;
}, 20, 3);


/* Tonen productvelden in cart + checkout */
add_filter('woocommerce_get_item_data', function ($item_data, $cart_item) {

	$map = [
		'grovia_vereniging' => 'Vereniging',
		'grovia_team'       => 'Team',
	];

	foreach ($map as $k => $label) {
		if (!empty($cart_item[$k])) {
			$item_data[] = [
				'name'  => $label,
				'value' => $cart_item[$k]
			];
		}
	}

	return $item_data;
}, 20, 2);


/* Opslaan productvelden op orderregel */
add_action('woocommerce_checkout_create_order_line_item', function ($item, $cart_item_key, $values, $order) {

	$map = [
		'grovia_vereniging' => 'Vereniging',
		'grovia_team'       => 'Team',
	];

	foreach ($map as $k => $label) {
		if (!empty($values[$k])) {
			$item->add_meta_data($label, $values[$k], true);
		}
	}

}, 20, 4);


/* Checkout velden aanpassen */
add_filter('woocommerce_checkout_fields', function($fields){

	if (isset($fields['billing']['billing_phone'])) {
		$fields['billing']['billing_phone']['required'] = true;
	}

	return $fields;
}, 999);


/* Extra blok onder factuurgegevens voor kind/deelnemer */
add_action('woocommerce_after_checkout_billing_form', function($checkout){

	echo '<div class="grovia-kind-gegevens" style="margin-top:30px;">';
	echo '<h3>Gegevens van het kind / de deelnemer</h3>';
	echo '<p style="margin-bottom:15px;">Vul hieronder de gegevens in van het kind of de persoon die je gaat aanmelden.</p>';

	woocommerce_form_field('grovia_kind_naam', [
		'type'        => 'text',
		'class'       => ['form-row-wide'],
		'label'       => 'Naam kind',
		'placeholder' => 'Bijv. Sam de Vries',
		'required'    => true,
	], $checkout->get_value('grovia_kind_naam'));

	woocommerce_form_field('grovia_kind_geboortedatum', [
		'type'        => 'date',
		'class'       => ['form-row-wide'],
		'label'       => 'Geboortedatum kind',
		'required'    => true,
	], $checkout->get_value('grovia_kind_geboortedatum'));

	echo '</div>';
});


/* Validatie checkout velden */
add_action('woocommerce_checkout_process', function(){

	$kind_naam = isset($_POST['grovia_kind_naam']) ? trim(wp_unslash($_POST['grovia_kind_naam'])) : '';
	$kind_geboortedatum = isset($_POST['grovia_kind_geboortedatum']) ? trim(wp_unslash($_POST['grovia_kind_geboortedatum'])) : '';
	$billing_phone = isset($_POST['billing_phone']) ? trim(wp_unslash($_POST['billing_phone'])) : '';

	if ($kind_naam === '') {
		wc_add_notice('Vul de naam van het kind in.', 'error');
	}

	if ($kind_geboortedatum === '') {
		wc_add_notice('Vul de geboortedatum van het kind in.', 'error');
	}

	if ($billing_phone === '') {
		wc_add_notice('Vul een telefoonnummer in.', 'error');
	}
});


/* Opslaan kindgegevens op order */
add_action('woocommerce_checkout_create_order', function($order, $data){

	if (!empty($_POST['grovia_kind_naam'])) {
		$order->update_meta_data('Naam kind', sanitize_text_field(wp_unslash($_POST['grovia_kind_naam'])));
	}

	if (!empty($_POST['grovia_kind_geboortedatum'])) {
		$order->update_meta_data('Geboortedatum kind', sanitize_text_field(wp_unslash($_POST['grovia_kind_geboortedatum'])));
	}

}, 10, 2);


/* Tonen in admin order */
add_action('woocommerce_admin_order_data_after_billing_address', function($order){
	$kind_naam = $order->get_meta('Naam kind');
	$kind_geboortedatum = $order->get_meta('Geboortedatum kind');

	if ($kind_naam || $kind_geboortedatum) {
		echo '<div style="margin-top:15px;">';
		echo '<h3>Gegevens kind / deelnemer</h3>';

		if ($kind_naam) {
			echo '<p><strong>Naam kind:</strong> ' . esc_html($kind_naam) . '</p>';
		}

		if ($kind_geboortedatum) {
			echo '<p><strong>Geboortedatum kind:</strong> ' . esc_html($kind_geboortedatum) . '</p>';
		}

		echo '</div>';
	}
});


/* Verwijderen-link tonen op afrekenen */
add_filter('woocommerce_cart_item_name', function($name, $cart_item, $cart_item_key){

	if ( ! is_checkout() || is_wc_endpoint_url('order-received') ) {
		return $name;
	}

	$remove_url = wc_get_cart_remove_url($cart_item_key);

	$name .= sprintf(
		' <a class="grovia-remove-from-checkout" href="%s" aria-label="%s">Verwijderen</a>',
		esc_url($remove_url),
		esc_attr__('Verwijder dit product', 'woocommerce')
	);

	return $name;
}, 99, 3);
