function css(element, style) {
  for (const property in style) {
    element.style[property] = style[property];
  }
}

async function getExchangePrice(timestamp) {
  const date = new Date(timestamp).toISOString().split("T")[0];
  try {
    const response = await fetch(
      `https://cors.genostore.us/https://api.apis.net.pe/v1/tipo-cambio-sunat?fecha=${date}`,
      {
        headers: {
          "Content-Type": "application/json",
          Referer: "https://apis.net.pe/tipo-de-cambio-sunat-api",
          Authorization: "Bearer apis-token-1.aTSI1U7KEuT-6bbbCguH-4Y8TI6KS73N",
        },
      }
    );
    const data = await response.json();
    console.log("Data Exchange", data);
    return parseFloat(data.compra);
  } catch (error) {
    console.log("Failing", error);
    return 3.8;
  }
}

async function parseOrder() {
  const order = window.GB_OrderDetail.order;
  const exchangeRate = await getExchangePrice(order.paymentTime);
  const items = order.preOrderGoodsList.map((item) => {
    const { avgPrice, product, quantity, sku_sale_attr } = item;
    return {
      name: product.goods_name,
      price: avgPrice.usdAmount * exchangeRate,
      sku: product.goods_sn,
      image: product.goods_img.replace(/_thumbnail_.*(.jpg)/, ".jpg"),
      quantity,
      options: sku_sale_attr.map(({ attr_name, attr_value_name }) => ({
        name: attr_name,
        value: attr_value_name,
      })),
    };
  });
  return {
    products: items,
  };
}

function verifySiteOrder() {
  const location = window.location.pathname;
  const { groups } =
    location.match(/^\/user\/orders\/detail\/(?<orderCode>[A-Z0-9]+)$/) || {};
  if (!groups) {
    return {
      orderCode: null,
      valid: false,
    };
  }
  return {
    orderCode: groups.orderCode,
    valid: true,
  };
}

async function sendOrderItems() {
  const button = document.getElementById("genostore-save-btn");
  if (button.disabled) {
    return;
  }
  button.disabled = true;
  button.innerHTML = "Cargando Productos...";
  button.style.cursor = "not-allowed";
  try {
    const orderItems = await parseOrder();
    console.log("orderItems", orderItems);
    const response = await fetch(
      "https://service.genostore.us/create-product",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderItems),
      }
    );
    if (response.ok) {
      const data = await response.json();
      for (product of data.products) {
        const { variants } = product;
        const [variant] = variants;
        const rowTable = document.querySelector(
          `[aria-label="SKU${variant.sku}"]`
        );
        if (rowTable) {
          const span = document.createElement("span");
          span.dataset.genostore = "genostore-item";
          span.innerHTML = "Actualizado";
          css(span, {
            fontSize: "12px",
            color: "#7FB77E",
            fontStyle: "italic",
            fontWeight: "bold",
            display: "block",
          });
          rowTable.appendChild(span);
          const link = document.createElement("a");
          link.href = `https://genostoreaqp.myshopify.com/admin/products/${product.id}`;
          link.innerHTML = "Editar Producto";
          link.target = "_blank";
          css(link, {
            fontSize: "12px",
            color: "#277BC0",
            fontStyle: "italic",
            fontWeight: "bold",
            display: "block",
          });
          rowTable.appendChild(link);
        }
      }
    } else {
      throw new Error("fetch failed");
    }
  } catch (error) {
    alert(`No se ha podido procesar los datos ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = "Guardar Orden en Tienda";
    button.style.cursor = "pointer";
  }
}

function addButton(orderCode) {
  const button = document.createElement("button");
  button.innerHTML = "Guardar Orden en Tienda";
  button.id = "genostore-save-btn";
  button.onclick = sendOrderItems;
  css(button, {
    minWidth: "80px",
    height: "28px",
    lineHeight: "26px",
    padding: "0 10px",
    fontSize: "12px",
    border: "1px solid #222222",
    backgroundColor: "white",
    color: "#222222",
    fontWeight: "bold",
    display: "block",
    textAlign: "center",
    margin: "auto",
    cursor: "pointer",
  });
  const splitOrderCode = ` ${orderCode.split("").join(" ")}`;
  const element = document.querySelector(
    `.order-info > li > [aria-label="${splitOrderCode}"]`
  );
  element.appendChild(button);
}

(() => {
  const siteOrder = verifySiteOrder();
  if (siteOrder.valid) {
    addButton(siteOrder.orderCode);
  }
})();
