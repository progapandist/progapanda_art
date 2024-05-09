class CreateWorks < ActiveRecord::Migration[7.1]
  def change
    create_table :works do |t|
      t.string :slug
      t.date :creation_date
      t.integer :listing_price
      t.string :medium
      t.text :description
      t.string :dimensions

      t.timestamps
    end
  end
end
