class WorksController < ApplicationController
  def index
    all_works = Work.all.to_a
    @work = all_works.first
    @position = 1
    @total = all_works.length
    @prev_slug = nil
    @next_slug = all_works[1]&.slug
  end

  def show
    all_works = Work.all.to_a
    idx = all_works.index { |w| w.slug == params[:slug] }
    raise ActiveRecord::RecordNotFound unless idx

    @work = all_works[idx]
    @total = all_works.length
    @position = idx + 1
    @prev_slug = idx > 0 ? all_works[idx - 1].slug : nil
    @next_slug = all_works[(idx + 1) % @total].slug

    respond_to do |format|
      format.html
      format.json do
        render json: {
          slug: @work.slug,
          title: @work.title,
          imgproxy_url: @work.imgproxy_url,
          location: @work.location,
          year: @work.year,
          description: @work.description,
          dimensions: @work.dimensions.present? ? "#{@work.height} x #{@work.width} #{@work.depth} cm" : nil,
          permalink: work_path(@work.slug),
          prev_slug: @prev_slug,
          next_slug: @next_slug,
          position: @position,
          total: @total
        }
      end
    end
  end

  def grid
    @works = Work.all
    return_slug = params[:from].presence
    @return_slug = Work.exists?(slug: return_slug) ? return_slug : nil
    @return_path = @return_slug ? work_path(@return_slug) : root_path
  end
end
