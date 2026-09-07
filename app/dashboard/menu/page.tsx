/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description?: string;
}

const initialMenuItems: MenuItem[] = [
  {
    id: "1",
    name: "Artisan Latte",
    category: "Coffee",
    price: 4.5,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAYEqwRAEasF1EuU7r9tyZUSkTmI8WdK8SkBXzzMFEGl1PtPnNlRL8ex3bxpZ86DoeLneYL0BwU1ns2ynN1JP7eyQuLqsbECK5mLYlCIPU2CGZRR-F_s_jjN2kzis_jfgxbTmnNMMpl8OFy3p2EjX6sDI1uS82W4T_p4wBLMSBQvKPeRmyZ90qy_TAwilgEIRS45f68XKeNyUzWkC5ZTXRZiXGO1ToZxKv9oDCM8LAfVJk02Lf4wJTeWQ",
  },
  {
    id: "2",
    name: "Butter Croissant",
    category: "Pastries",
    price: 3.75,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBIhwy5YUNWUj_XHkxG2FJQyRMV-15sYB-W_zsqnfmDh6bk7khqPt26h4ftd-2UZ712Yx8kAlCfFdZH8KPwupbDXhFlDgLJcXfzzvA5TNRXpg2zDJH9uxc0vAhSEMMtyEgopy4QXwhYJ_CHozHZSRpxB4qwGGlJN24cbISU0O3FfiNI6jQ72_k9vd0qXi-hOQa1QRNmTZeo7SZNYqG_nFMHTxVkwe9PDDVQVM6Zy8e2p1M0k2aql8ZG0A",
  },
  {
    id: "3",
    name: "Iced Matcha",
    category: "Tea",
    price: 5.25,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBCIFTzcWEWAfD1nGblpBVIzxLR4rFYe_7cIMUf8PnkmuUVwfNofIPX2Go_tnDzJuurvM_h1azSHa4qNOx785JZwVyMJoaM5a07Tjbbe62Re9sWKuZQmpOYlqimyf417R_PT732BmMXMxm7YzNdhG8YFgU_vJIsORBfdRk1yEmM88IK177tyRF-ZxcURShOG4Q0MSaQBa0wOZ-KGkbc5Rgt7q0o7yI8pbjdPvTBeb_-Qz4wHbpFZNfsEg",
  },
];

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Coffee");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImage, setNewItemImage] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All Categories" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;

    const newItem: MenuItem = {
      id: Date.now().toString(),
      name: newItemName,
      category: newItemCategory,
      price: parseFloat(newItemPrice) || 0,
      description: newItemDesc,
      image:
        newItemImage ||
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAYEqwRAEasF1EuU7r9tyZUSkTmI8WdK8SkBXzzMFEGl1PtPnNlRL8ex3bxpZ86DoeLneYL0BwU1ns2ynN1JP7eyQuLqsbECK5mLYlCIPU2CGZRR-F_s_jjN2kzis_jfgxbTmnNMMpl8OFy3p2EjX6sDI1uS82W4T_p4wBLMSBQvKPeRmyZ90qy_TAwilgEIRS45f68XKeNyUzWkC5ZTXRZiXGO1ToZxKv9oDCM8LAfVJk02Lf4wJTeWQ",
    };

    setItems((prev) => [newItem, ...prev]);
    // reset form
    setNewItemName("");
    setNewItemPrice("");
    setNewItemDesc("");
    setNewItemImage(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-margin-page bg-surface-bright min-h-full">
      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-stack-lg gap-stack-md">
        <div className="flex flex-wrap gap-stack-sm w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              className="h-9 pl-9 pr-4 w-full rounded-lg border border-border-subtle bg-surface-card text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-surface"
              placeholder="Search menu items..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface-card text-body-md font-body-md text-on-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option>All Categories</option>
            <option>Coffee</option>
            <option>Tea</option>
            <option>Pastries</option>
            <option>Food</option>
          </select>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md px-stack-md h-9 rounded-lg flex items-center gap-unit transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add New Item
        </button>
      </div>

      {/* Data Table Card */}
      <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-surface border-b border-border-subtle text-on-surface-variant font-label-md text-label-md">
                <th className="py-stack-sm px-gutter font-semibold w-16">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    Photo
                  </span>
                </th>
                <th className="py-stack-sm px-gutter font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                    Name
                  </span>
                </th>
                <th className="py-stack-sm px-gutter font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">category</span>
                    Category
                  </span>
                </th>
                <th className="py-stack-sm px-gutter font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">sell</span>
                    Price
                  </span>
                </th>
                <th className="py-stack-sm px-gutter font-semibold text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="material-symbols-outlined text-[14px]">settings</span>
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md divide-y divide-border-subtle">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 text-on-surface-variant/40 block">
                      search_off
                    </span>
                    No menu items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container-low transition-colors group"
                  >
                    <td className="py-3 px-gutter">
                      <img
                        className="w-10 h-10 rounded-lg object-cover border border-border-subtle shadow-2xs"
                        alt={item.name}
                        src={item.image}
                      />
                    </td>
                    <td className="py-3 px-gutter font-semibold text-on-background">
                      {item.name}
                    </td>
                    <td className="py-3 px-gutter text-on-surface-variant">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-surface-container text-on-surface">
                        <span className="material-symbols-outlined text-[13px]">
                          {item.category === "Coffee"
                            ? "local_cafe"
                            : item.category === "Tea"
                            ? "emoji_food_beverage"
                            : item.category === "Pastries"
                            ? "bakery_dining"
                            : "restaurant"}
                        </span>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-gutter font-bold text-on-background">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-gutter text-right">
                      <div className="flex items-center justify-end gap-2 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-on-surface-variant hover:text-error p-1 rounded-md hover:bg-error-container transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Backdrop & Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl shadow-lg w-full max-w-md border border-border-subtle overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="px-gutter py-stack-md border-b border-border-subtle flex justify-between items-center bg-surface">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  add_circle
                </span>
                <h3 className="font-headline-md text-headline-md font-semibold text-on-background">
                  Add New Item
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-background transition-colors p-1 rounded-md"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddItem} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-gutter overflow-y-auto font-body-md text-body-md flex flex-col gap-stack-md">
                {/* Photo Upload Area */}
                <div>
                  <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant mb-unit">
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    Item Photo
                  </label>
                  <label className="border-2 border-dashed border-border-subtle rounded-lg h-32 flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:border-secondary cursor-pointer transition-all overflow-hidden relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewItemImage(URL.createObjectURL(file));
                        }
                      }}
                    />
                    {newItemImage ? (
                      <img
                        src={newItemImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <span className="material-symbols-outlined mb-1 text-[28px]">
                          add_photo_alternate
                        </span>
                        <span className="font-label-md text-label-md">
                          Click to upload image
                        </span>
                      </>
                    )}
                  </label>
                </div>

                {/* Input: Name */}
                <div>
                  <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant mb-unit">
                    <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                    Item Name
                  </label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-background"
                    placeholder="e.g. Avocado Toast"
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>

                {/* Input: Category & Price Row */}
                <div className="flex gap-stack-md">
                  <div className="flex-1">
                    <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant mb-unit">
                      <span className="material-symbols-outlined text-[16px]">category</span>
                      Category
                    </label>
                    <select
                      className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-background cursor-pointer"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                    >
                      <option value="Coffee">Coffee</option>
                      <option value="Tea">Tea</option>
                      <option value="Pastries">Pastries</option>
                      <option value="Food">Food</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant mb-unit">
                      <span className="material-symbols-outlined text-[16px]">sell</span>
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">
                        $
                      </span>
                      <input
                        className="w-full h-9 pl-7 pr-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-background"
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        required
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Input: Description */}
                <div>
                  <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant mb-unit">
                    <span className="material-symbols-outlined text-[16px]">notes</span>
                    Description
                  </label>
                  <textarea
                    className="w-full p-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-background resize-none"
                    placeholder="Brief description of the item..."
                    rows={3}
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-gutter py-stack-md border-t border-border-subtle bg-surface flex justify-end gap-stack-sm">
                <button
                  type="button"
                  className="px-stack-md h-9 rounded-lg border border-border-subtle bg-surface-card text-on-background font-label-md text-label-md hover:bg-surface-container-low transition-colors cursor-pointer flex items-center gap-1"
                  onClick={() => setIsModalOpen(false)}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-stack-md h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
