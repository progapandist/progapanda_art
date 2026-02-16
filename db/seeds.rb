require "thor"

ART_SOURCE_DIR = Rails.env.production? ? Rails.root.join("art_sources") : "/Users/progapandist/progapanda_art_sources"
DEFAULT_CITY = "Berlin"
DEFAULT_YEAR = Time.current.year

class Seeder < Thor
  include Thor::Actions

  desc "go_seed", "Seed the database with works"

  def go_seed
    Work.destroy_all

    say "Checking directory: #{ART_SOURCE_DIR}", :red

    filenames = Dir.children(ART_SOURCE_DIR.to_s)
      .select { |f| File.file?(File.join(ART_SOURCE_DIR, f)) }
      .reject { |f| f.start_with?(".") }
      .sort

    artwork_config = Rails.application.config_for(:artworks)[:artworks]
    infos_by_slug = artwork_config.index_by { |a| a[:slug] }

    filenames.each do |filename|
      slug_name = File.basename(filename, ".*")
      say "Processing #{slug_name}...", :green

      ActiveRecord::Base.transaction do
        work = Work.find_or_initialize_by(slug: slug_name)
        info = infos_by_slug[slug_name]

        if info
          info[:title] = slug_name.humanize if info[:title].blank?
          work.update!(info)
        else
          work.update!(
            title: slug_name.humanize,
            location: DEFAULT_CITY,
            year: DEFAULT_YEAR
          )
        end

        work.update!(imgproxy_url:
          Imgproxy.url_for(
            slug_name,
            width: 3840,
            height: 2160,
            resizing_type: :auto,
            gravity: :sm,
            format: :avif
          ))
      end
    end
  end

  Seeder.new.go_seed
end
